import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import type { PendingEdit } from "#publishing/application/live-post-edits.ts";
import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { LivePostChangeIdSchema } from "#publishing/domain/live-post-change-id.ts";
import { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishResult } from "#shared/domain/publish-result.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  fakeSlackApi,
  slackAccount,
  slackBotToken,
  slackChannel,
  slackError,
} from "#test/publishing/fakes/fake-slack-api.ts";
import type { FakeSlackOptions } from "#test/publishing/fakes/fake-slack-api.ts";
import { empty } from "#test/publishing/fakes/platform-server.ts";

import {
  attached,
  credentialsOf,
  liveClientsOn,
  outgoing,
  slackClientWith,
  testFile,
} from "./support.ts";
import type { TestFile } from "./support.ts";

// Deleting and editing posts on Slack, against the loopback fake, as the
// gates' RemoveLivePost and EditLivePost calls do.

const channelId = ChannelIdSchema.make("00000000-0000-7000-8000-0000000000c3");

const changeId = LivePostChangeIdSchema.make(
  "00000000-0000-7000-8000-0000000000e3"
);

const idOf = (result: PublishResult) =>
  result._tag === "published"
    ? Effect.succeed(result.platformPostId)
    : Effect.die(`The post was not published: ${result._tag}`);

const onSlack = Effect.fn("test.onSlack")(function* onSlack(
  options: {
    readonly api?: FakeSlackOptions;
    readonly edit?: PendingEdit;
    readonly files?: readonly TestFile[];
  } = {}
) {
  const slack = yield* fakeSlackApi(options.api);

  const credentials = Layer.succeedContext(
    yield* Layer.build(
      credentialsOf({ accountId: slackAccount, platform: "slack" }, [
        slackBotToken,
      ])
    )
  );

  const client = yield* slackClientWith({
    api: slack.url,
    credentials,
    files: options.files ?? [],
  });

  const live = yield* liveClientsOn({
    credentials,
    edits:
      options.edit === undefined
        ? new Map()
        : new Map([[changeId, options.edit]]),
    platforms: { slackHosts: { api: slack.url, uploads: slack.url } },
  });

  return { client, live, slack };
});

const post = (fields: Partial<OutgoingPost> = {}) =>
  outgoing({ ...fields, accountId: slackAccount });

const editTo = (text: string, media: readonly MediaAttachment[] = []) => ({
  media,
  options: Option.none(),
  text,
});

describe("deleting and editing on Slack", () => {
  it.live("deletes a message, and takes one gone as gone", () =>
    Effect.gen(function* deletes() {
      const { client, live, slack } = yield* onSlack();

      const platformPostId = yield* idOf(yield* client.publish(yield* post()));

      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "removed"
      );
      assert.deepStrictEqual(slack.messages(), []);
      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "alreadyGone"
      );
    }).pipe(Effect.scoped)
  );

  it.live("deletes a message's images with it", () =>
    Effect.gen(function* images() {
      const image = testFile("image", 512);
      const { client, live, slack } = yield* onSlack({ files: [image] });

      const platformPostId = yield* idOf(
        yield* client.publish(yield* post({ media: [attached(image)] }))
      );

      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "removed"
      );
      assert.deepStrictEqual(
        slack.files().map(({ deleted }) => deleted),
        [true]
      );
      // Gone already, files and all: a second run is gone too.
      assert.strictEqual(
        yield* live.remove({ channelId, platformPostId }),
        "alreadyGone"
      );
    }).pipe(Effect.scoped)
  );

  it.live(
    "counts a message deleted as removed, even when Slack keeps its images",
    () =>
      Effect.gen(function* kept() {
        const image = testFile("image", 512);
        const { client, live, slack } = yield* onSlack({ files: [image] });

        const platformPostId = yield* idOf(
          yield* client.publish(yield* post({ media: [attached(image)] }))
        );

        slack.script("files.delete", [slackError("file_deleting_disabled")]);

        assert.strictEqual(
          yield* live.remove({ channelId, platformPostId }),
          "removed"
        );
        assert.deepStrictEqual(slack.messages(), []);
      }).pipe(Effect.scoped)
  );

  it.live(
    "asks nothing of an id that is not a message of Peal's, or of another channel",
    () =>
      Effect.gen(function* invalid() {
        const { live, slack } = yield* onSlack({ edit: editTo("Corrected") });

        for (const id of [
          "not-a-slack-message",
          "C0OTHER01/1790000000.000001",
        ]) {
          const platformPostId = PlatformPostIdSchema.make(id);

          assert.deepStrictEqual(
            yield* live.remove({ channelId, platformPostId }).pipe(Effect.flip),
            new BadRequest({ code: "invalidPlatformId" })
          );
          assert.deepStrictEqual(
            yield* live
              .edit({ changeId, channelId, platformPostId })
              .pipe(Effect.flip),
            new BadRequest({ code: "invalidPlatformId" })
          );
        }

        assert.deepStrictEqual(slack.requests(), []);
      }).pipe(Effect.scoped)
  );

  it.live("edits a text, escaped, and sends it alone", () =>
    Effect.gen(function* edits() {
      const { client, live, slack } = yield* onSlack({
        edit: editTo("Corrected <!here> & more"),
      });

      const platformPostId = yield* idOf(yield* client.publish(yield* post()));

      assert.strictEqual(
        yield* live.edit({ changeId, channelId, platformPostId }),
        "edited"
      );

      const [call] = slack.calls("chat.update");

      assert(call !== undefined);
      assert.deepStrictEqual(slack.sentOf(call), {
        channel: slackChannel,
        text: "Corrected &lt;!here&gt; &amp; more",
        ts: "1790000000.000001",
      });
    }).pipe(Effect.scoped)
  );

  it.live(
    "edits a message with images, sending its image blocks again with their alt text",
    () =>
      Effect.gen(function* images() {
        const image = testFile("image", 512);

        const { client, live, slack } = yield* onSlack({
          edit: editTo("Corrected", [
            new MediaAttachment({
              altText: "A synthetic chart",
              mediaId: image.media.mediaId,
            }),
          ]),
          files: [image],
        });

        const platformPostId = yield* idOf(
          yield* client.publish(
            yield* post({ media: [attached(image)], text: "First" })
          )
        );

        yield* live.edit({ changeId, channelId, platformPostId });

        assert.deepStrictEqual(slack.messages()[0]?.blocks, [
          {
            text: { text: "Corrected", type: "mrkdwn", verbatim: true },
            type: "section",
          },
          {
            alt_text: "A synthetic chart",
            slack_file: { id: "F0SYNTH001" },
            type: "image",
          },
        ]);
        assert.strictEqual(slack.messages()[0]?.text, "Corrected");
      }).pipe(Effect.scoped)
  );

  it.live(
    "refuses an edit of a message gone, or one the workspace no longer lets be edited, by Slack's code",
    () =>
      Effect.gen(function* refused() {
        const { client, live, slack } = yield* onSlack({
          edit: editTo("Corrected"),
        });

        const platformPostId = yield* idOf(
          yield* client.publish(yield* post())
        );

        slack.script("chat.update", [
          slackError("message_not_found"),
          slackError("edit_window_closed"),
          empty(503),
        ]);

        assert.deepStrictEqual(
          yield* live
            .edit({ changeId, channelId, platformPostId })
            .pipe(Effect.flip),
          new BadRequest({ code: "postGone" })
        );
        assert.deepStrictEqual(
          yield* live
            .edit({ changeId, channelId, platformPostId })
            .pipe(Effect.flip),
          new BadRequest({ code: "slack:edit_window_closed" })
        );
        assert.deepStrictEqual(
          yield* live
            .edit({ changeId, channelId, platformPostId })
            .pipe(Effect.flip),
          new PlatformUnavailable({ code: "unansweredAfterSending" })
        );
      }).pipe(Effect.scoped)
  );

  it.live("takes a revoked token as refused", () =>
    Effect.gen(function* revoked() {
      const { client, live, slack } = yield* onSlack();

      const platformPostId = yield* idOf(yield* client.publish(yield* post()));

      slack.revoke();

      assert.deepStrictEqual(
        yield* live.remove({ channelId, platformPostId }).pipe(Effect.flip),
        new TokenExpired()
      );
    }).pipe(Effect.scoped)
  );
});
