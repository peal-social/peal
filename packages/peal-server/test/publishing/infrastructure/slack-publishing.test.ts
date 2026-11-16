import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Scope } from "effect";
import { MessageStorage } from "effect/cluster";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import { LinkShortener } from "#publishing/application/link-shortener.ts";
import { PostMeter } from "#publishing/application/post-meter.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
import { RoutedPlatformPublisher } from "#publishing/application/routed-platform-publisher.ts";
import { PostContent } from "#publishing/domain/post-content.ts";
import { PostPart } from "#publishing/domain/post-part.ts";
import { DrizzlePlatformQuota } from "#publishing/infrastructure/drizzle-platform-quota.ts";
import { DrizzlePublicationProgress } from "#publishing/infrastructure/drizzle-publication-progress.ts";
import { DrizzleRecordedPosts } from "#publishing/infrastructure/drizzle-recorded-posts.ts";
import { DrizzleUploadSessions } from "#publishing/infrastructure/drizzle-upload-sessions.ts";
import { platformClientsWith } from "#publishing/infrastructure/platforms/platform-clients-live.ts";
import { newId } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  fakeSlackApi,
  slackAccount,
  slackBotToken,
} from "#test/publishing/fakes/fake-slack-api.ts";
import {
  credentialsOf,
  mediaOf,
  testTiming,
} from "#test/publishing/platforms/support.ts";
import { actorIn } from "#test/publishing/support.ts";

import {
  DatabaseTest,
  deploy,
  eventually,
  isFinished,
  isSuspended,
  newChannel,
  outcomeOf,
  scheduleIn,
  setTime,
  shutDown,
  targetsOf,
} from "./harness.ts";

// A thread on a Slack channel through the channel gates, as production
// runs it, against the loopback Slack: Slack keeps no key to post a
// message again under, so a lost answer is to check, and nothing after it
// is sent.

const timeout = 60_000;

// The platforms as production runs them, Slack on the fake, with
// stand-in credentials for its bot and no media.
const platformsOn = (url: string) => {
  const elsewhere = new URL("http://127.0.0.1:9");

  return RoutedPlatformPublisher.pipe(
    Layer.provide(
      platformClientsWith({
        discordHosts: { api: elsewhere.origin },
        googleBusinessApi: elsewhere,
        linkedinApi: elsewhere,
        mastodonScheme: "http:",
        metaAppSecret: Option.none(),
        metaHosts: {
          facebookDialog: elsewhere,
          facebookGraph: elsewhere,
          facebookUpload: elsewhere,
          instagramApi: elsewhere,
          instagramAuthorize: elsewhere,
          instagramGraph: elsewhere,
          threadsAuthorize: elsewhere,
          threadsGraph: elsewhere,
        },
        pinterestApi: elsewhere,
        slackHosts: { api: url, uploads: url },
        telegramHosts: { api: elsewhere.origin },
        tiktokApi: elsewhere,
        tiktokPullFrom: Option.none(),
        timing: testTiming,
        videoService: elsewhere,
        xApi: elsewhere,
        youtubeApi: elsewhere,
        youtubeDailyThumbnails: 100,
        youtubeDailyUploads: 100,
      })
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        credentialsOf({ accountId: slackAccount, platform: "slack" }, [
          slackBotToken,
        ]),
        mediaOf([]),
        LinkShortener.none,
        PostMeter.unmetered,
        DrizzlePublicationProgress,
        DrizzleUploadSessions,
        DrizzlePlatformQuota,
        DrizzleRecordedPosts
      )
    ),
    Layer.provide(
      Layer.mergeAll(
        FetchHttpClient.layer,
        OpenOutboundGuard,
        Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto)),
        SecureRandom.layerWebCrypto,
        Digest.layerWebCrypto
      )
    )
  );
};

// A thread of two parts on `channel` for 08:00, in a workspace of its own.
const scheduleThread = Effect.fn("test.scheduleThread")(
  function* scheduleThread(channel: ChannelId) {
    const workspaceId = yield* newId(WorkspaceIdSchema).pipe(
      Effect.provide(IdsLive)
    );

    const { post } = yield* PostScheduling.use((scheduling) =>
      scheduling.schedule(actorIn(workspaceId), {
        channelIds: [channel],
        content: new PostContent({
          followUps: [
            new PostPart({
              delaySeconds: 0,
              media: [],
              overrides: [],
              text: "A synthetic second part",
            }),
          ],
          media: [],
          overrides: [],
          text: "A synthetic first part",
        }),
        schedule: scheduleIn("2026-06-15T08:00:00Z"),
      })
    );

    return post;
  }
);

describe("publishing a thread on Slack through the channel gates", () => {
  it.effect(
    "posts each part after the other, the later ones in the first one's thread",
    () =>
      Effect.gen(function* sends() {
        yield* setTime("2026-06-15T07:00:00Z");

        const slack = yield* fakeSlackApi();

        const server = deploy(
          MessageStorage.layerMemory,
          platformsOn(slack.url)
        ).pipe(Layer.provideMerge(DatabaseTest));

        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(server, scope);
        const channel = yield* newChannel;

        const post = yield* scheduleThread(channel).pipe(
          Effect.provideContext(context)
        );

        yield* eventually("the job sleeps", isSuspended(post.id)).pipe(
          Effect.provideContext(context)
        );
        yield* setTime("2026-06-15T08:00:00Z");
        yield* eventually("the post finishes", isFinished(post.id)).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(
          yield* outcomeOf(post.id).pipe(Effect.provideContext(context)),
          "published"
        );
        const [first, second] = slack.messages();

        assert.deepStrictEqual(
          slack.messages().map(({ text }) => text),
          ["A synthetic first part", "A synthetic second part"]
        );
        assert.strictEqual(first?.threadTs, undefined);
        assert.strictEqual(second?.threadTs, first?.ts);

        const [target] = yield* targetsOf(post.id).pipe(
          Effect.provideContext(context)
        );

        assert(target?.status._tag === "published");
        assert.lengthOf(target.liveParts, 2);

        yield* shutDown(scope);
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "leaves a part whose answer was lost to check, sending it once and nothing after it",
    () =>
      Effect.gen(function* lost() {
        yield* setTime("2026-06-15T07:00:00Z");

        const slack = yield* fakeSlackApi();

        // Slack posts the first message, and the answer never comes.
        slack.script("chat.postMessage", [{ _tag: "postThenDrop" }]);

        const server = deploy(
          MessageStorage.layerMemory,
          platformsOn(slack.url)
        ).pipe(Layer.provideMerge(DatabaseTest));

        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(server, scope);
        const channel = yield* newChannel;

        const post = yield* scheduleThread(channel).pipe(
          Effect.provideContext(context)
        );

        yield* eventually("the job sleeps", isSuspended(post.id)).pipe(
          Effect.provideContext(context)
        );
        yield* setTime("2026-06-15T08:00:00Z");
        yield* eventually("the post finishes", isFinished(post.id)).pipe(
          Effect.provideContext(context)
        );

        const [target] = yield* targetsOf(post.id).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(target?.status._tag, "unconfirmed");
        assert.strictEqual(
          yield* outcomeOf(post.id).pipe(Effect.provideContext(context)),
          "unconfirmed"
        );
        // One commit, and the second part was never sent.
        assert.lengthOf(slack.calls("chat.postMessage"), 1);
        assert.lengthOf(slack.messages(), 1);

        yield* shutDown(scope);
      }).pipe(Effect.scoped),
    timeout
  );
});
