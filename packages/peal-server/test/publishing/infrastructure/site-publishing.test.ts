import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Scope } from "effect";
import { MessageStorage } from "effect/cluster";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import { LinkShortener } from "#publishing/application/link-shortener.ts";
import { PostMeter } from "#publishing/application/post-meter.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
import { RecordedArticles } from "#publishing/application/recorded-articles.ts";
import { RoutedPlatformPublisher } from "#publishing/application/routed-platform-publisher.ts";
import { ChannelOptions } from "#publishing/domain/channel-options.ts";
import { PostContent } from "#publishing/domain/post-content.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import { DrizzlePlatformQuota } from "#publishing/infrastructure/drizzle-platform-quota.ts";
import { DrizzlePublicationJournal } from "#publishing/infrastructure/drizzle-publication-journal.ts";
import { DrizzlePublicationProgress } from "#publishing/infrastructure/drizzle-publication-progress.ts";
import { DrizzleRecordedPosts } from "#publishing/infrastructure/drizzle-recorded-posts.ts";
import { DrizzleSiteFiles } from "#publishing/infrastructure/drizzle-site-files.ts";
import { DrizzleUploadSessions } from "#publishing/infrastructure/drizzle-upload-sessions.ts";
import { platformClientsWith } from "#publishing/infrastructure/platforms/platform-clients-live.ts";
import { siteCallsWith } from "#publishing/infrastructure/platforms/sites/site-calls-live.ts";
import { withSiteClients } from "#publishing/infrastructure/platforms/sites/site-client.ts";
import { newId } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  credentialsOf,
  mediaOf,
  testTiming,
} from "#test/publishing/platforms/support.ts";
import { actorIn, anyChannelOn } from "#test/publishing/support.ts";

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

// A post to a WordPress site through the channel gates, as production
// runs it, against the loopback WordPress: the posts' job, journal and
// policy, the site client and the adapter the articles use too.

const timeout = 60_000;

// The platforms as production runs them, the site on the fake.
const platformsOn = (root: string) => {
  const elsewhere = new URL("http://127.0.0.1:9");

  const calls = siteCallsWith({
    devto: { api: elsewhere.origin },
    hashnode: { api: `${elsewhere.origin}/` },
    wordpressCom: { api: elsewhere.origin },
  }).pipe(
    Layer.provide(mediaOf([])),
    Layer.provide(Layer.merge(FetchHttpClient.layer, OpenOutboundGuard))
  );

  return RoutedPlatformPublisher.pipe(
    Layer.provide(
      withSiteClients(
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
          slackHosts: { api: elsewhere.origin, uploads: elsewhere.origin },
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
      )
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        credentialsOf({ accountId: root, platform: "wordpress" }, [
          `${editor.login}:${editor.password}`,
        ]),
        mediaOf([]),
        calls,
        LinkShortener.none,
        PostMeter.unmetered,
        RecordedArticles.none,
        DrizzlePublicationProgress,
        DrizzlePublicationJournal,
        DrizzleSiteFiles,
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

// A post for 08:00 on `channel`, a WordPress site's, in a workspace of
// its own.
const scheduleArticle = Effect.fn("test.scheduleArticle")(
  function* scheduleArticle(channel: ChannelId) {
    const workspaceId = yield* newId(WorkspaceIdSchema).pipe(
      Effect.provide(IdsLive)
    );

    const { post } = yield* PostScheduling.use((scheduling) =>
      scheduling.schedule(actorIn(workspaceId), {
        channelIds: [channel],
        content: new PostContent({
          media: [],
          overrides: [],
          text: "A synthetic article, written once.\n\nIts second paragraph.",
        }),
        options: [
          new ChannelOptions({
            channelId: channel,
            options: new WordPressOptions({
              tags: ["Synthetic"],
              title: "A synthetic article",
            }),
          }),
        ],
        schedule: scheduleIn("2026-06-15T08:00:00Z"),
      })
    );

    return post;
  }
);

describe("publishing a post on a WordPress site through the channel gates", () => {
  it.effect(
    "sends it at its time as an article, its title and paragraphs, and records the site's post",
    () =>
      Effect.gen(function* sends() {
        yield* setTime("2026-06-15T07:00:00Z");

        const site = yield* fakeWordPress();

        const server = deploy(
          MessageStorage.layerMemory,
          platformsOn(site.root),
          anyChannelOn("wordpress")
        ).pipe(Layer.provideMerge(DatabaseTest));

        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(server, scope);
        const channel = yield* newChannel;

        const post = yield* scheduleArticle(channel).pipe(
          Effect.provideContext(context)
        );

        yield* eventually("the job sleeps", isSuspended(post.id)).pipe(
          Effect.provideContext(context)
        );

        // Nothing is on the site before the post's time.
        assert.lengthOf(site.posts(), 0);

        yield* setTime("2026-06-15T08:00:00Z");
        yield* eventually("the post finishes", isFinished(post.id)).pipe(
          Effect.provideContext(context)
        );

        assert.strictEqual(
          yield* outcomeOf(post.id).pipe(Effect.provideContext(context)),
          "published"
        );

        const [made] = site.posts();

        assert.strictEqual(made?.title, "A synthetic article");
        assert.strictEqual(made?.status, "publish");
        assert.include(made?.content ?? "", "<p>Its second paragraph.</p>");
        assert.lengthOf(site.tags(), 1);

        const [target] = yield* targetsOf(post.id).pipe(
          Effect.provideContext(context)
        );

        assert(target?.status._tag === "published");
        assert.deepStrictEqual(
          target.status.platformPostId,
          Option.some(String(made?.id))
        );

        yield* shutDown(scope);
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "finds and adopts the post whose answer was lost, never making a second",
    () =>
      Effect.gen(function* lost() {
        yield* setTime("2026-06-15T07:00:00Z");

        // The site makes the post, and the answer never comes.
        let dropped = false;

        const site = yield* fakeWordPress({
          drop: (request) => {
            if (
              dropped ||
              request.method !== "POST" ||
              request.route !== "/wp/v2/posts"
            ) {
              return false;
            }

            dropped = true;

            return true;
          },
        });

        const server = deploy(
          MessageStorage.layerMemory,
          platformsOn(site.root),
          anyChannelOn("wordpress")
        ).pipe(Layer.provideMerge(DatabaseTest));

        const scope = yield* Scope.make();
        const context = yield* Layer.buildWithScope(server, scope);
        const channel = yield* newChannel;

        const post = yield* scheduleArticle(channel).pipe(
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

        assert.strictEqual(target?.status._tag, "published");
        assert.lengthOf(site.posts(), 1);

        yield* shutDown(scope);
      }).pipe(Effect.scoped),
    timeout
  );
});
