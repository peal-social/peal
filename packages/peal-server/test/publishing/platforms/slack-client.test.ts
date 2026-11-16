import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Option } from "effect";

import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { SlackOptions } from "#publishing/domain/slack-options.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  fakeSlackApi,
  slackAccount,
  slackBotToken,
  slackChannel,
  slackError,
} from "#test/publishing/fakes/fake-slack-api.ts";
import type { FakeSlackOptions } from "#test/publishing/fakes/fake-slack-api.ts";
import { empty, json } from "#test/publishing/fakes/platform-server.ts";

import {
  attached,
  credentialsOf,
  httpClientTimingOutAfter,
  outgoing,
  slackClientWith,
  testFile,
} from "./support.ts";
import type { TestFile } from "./support.ts";

const onSlack = Effect.fn("test.onSlack")(function* onSlack(
  options: {
    readonly api?: FakeSlackOptions;
    readonly files?: readonly TestFile[];
    /** Where the fake's upload addresses are, if not its own origin. */
    readonly uploads?: string;
    readonly timeout?: Duration.Input;
  } = {}
) {
  const slack = yield* fakeSlackApi(options.api);

  const credentials = credentialsOf(
    { accountId: slackAccount, platform: "slack" },
    [slackBotToken]
  );

  const client = yield* slackClientWith({
    api: slack.url,
    credentials,
    files: options.files ?? [],
    http:
      options.timeout === undefined
        ? undefined
        : yield* httpClientTimingOutAfter(options.timeout),
    uploads: options.uploads ?? slack.url,
  });

  return { client, slack };
});

const post = (fields: Partial<OutgoingPost> = {}) =>
  outgoing({ ...fields, accountId: slackAccount });

const firstTs = "1790000000.000001";

const commits = (slack: { calls: (method: string) => readonly unknown[] }) =>
  slack.calls("chat.postMessage");

describe("publishing in a Slack channel with the app's bot", () => {
  it.live("posts a text, escaped, and links to it", () =>
    Effect.gen(function* text() {
      const { client, slack } = yield* onSlack();

      const result = yield* client.publish(
        yield* post({ text: "Synthetic *news* at https://example.com" })
      );

      assert.deepStrictEqual(result, {
        _tag: "published",
        permalink: `https://synthetic.slack.com/archives/${slackChannel}/p1790000000000001`,
        platformPostId: PlatformPostIdSchema.make(`${slackChannel}/${firstTs}`),
      });
      assert.deepStrictEqual(slack.messages()[0]?.fields, {
        channel: slackChannel,
        text: "Synthetic *news* at https://example.com",
        unfurl_links: false,
      });
    }).pipe(Effect.scoped)
  );

  it.live(
    "mentions nobody: <, > and & reach Slack as entities, so no <!channel> or <@user> is read",
    () =>
      Effect.gen(function* escaped() {
        const { client, slack } = yield* onSlack();

        yield* client.publish(
          yield* post({
            text: "<!channel> <!here> <!everyone> <@U0SYNTH> & <https://example.com|a link> *bold*",
          })
        );

        assert.strictEqual(
          slack.messages()[0]?.text,
          "&lt;!channel&gt; &lt;!here&gt; &lt;!everyone&gt; &lt;@U0SYNTH&gt; &amp; &lt;https://example.com|a link&gt; *bold*"
        );
      }).pipe(Effect.scoped)
  );

  it.live("unfurls links when the options ask", () =>
    Effect.gen(function* unfurled() {
      const { client, slack } = yield* onSlack();

      yield* client.publish(
        yield* post({
          options: Option.some(new SlackOptions({ unfurlLinks: true })),
        })
      );

      assert.strictEqual(slack.messages()[0]?.fields["unfurl_links"], true);
    }).pipe(Effect.scoped)
  );

  it.live(
    "uploads images unshared, then posts them as image blocks under the text, with their alt text",
    () =>
      Effect.gen(function* images() {
        const first = testFile("image", 2048);
        const second = testFile("image", 1024, "image/gif");

        const { client, slack } = yield* onSlack({ files: [first, second] });

        const result = yield* client.publish(
          yield* post({
            media: [attached(first), attached(second, "")],
            text: "Synthetic <launch> & more",
          })
        );

        const uploaded = slack.files();

        assert.deepStrictEqual(
          uploaded.map(({ altText, bytes, completed, length, name }) => ({
            altText,
            bytes,
            completed,
            length,
            name,
          })),
          [
            {
              altText: "A synthetic picture",
              bytes: first.bytes,
              completed: true,
              length: 2048,
              name: first.media.fileName,
            },
            {
              altText: undefined,
              bytes: second.bytes,
              completed: true,
              length: 1024,
              name: second.media.fileName,
            },
          ]
        );

        // Completed without a channel: "the file will remain private".
        const [completion] = slack.calls("files.completeUploadExternal");

        assert(completion !== undefined);
        assert.strictEqual(slack.sentOf(completion)["channel_id"], undefined);
        assert.strictEqual(slack.sentOf(completion)["channels"], undefined);

        const [message] = slack.messages();

        assert(message !== undefined);
        assert.strictEqual(message.text, "Synthetic &lt;launch&gt; &amp; more");
        assert.deepStrictEqual(message.blocks, [
          {
            text: {
              text: "Synthetic &lt;launch&gt; &amp; more",
              type: "mrkdwn",
            },
            type: "section",
          },
          {
            alt_text: "A synthetic picture",
            slack_file: { id: "F0SYNTH001" },
            type: "image",
          },
          {
            alt_text: "Image",
            slack_file: { id: "F0SYNTH002" },
            type: "image",
          },
        ]);
        assert.deepStrictEqual(
          result._tag === "published" ? result.platformPostId : undefined,
          PlatformPostIdSchema.make(
            `${slackChannel}/${firstTs}/F0SYNTH001,F0SYNTH002`
          )
        );
      }).pipe(Effect.scoped)
  );

  it.live("posts images alone without a section", () =>
    Effect.gen(function* alone() {
      const image = testFile("image", 512);
      const { client, slack } = yield* onSlack({ files: [image] });

      yield* client.publish(
        yield* post({ media: [attached(image)], text: "" })
      );

      const [message] = slack.messages();

      assert(message !== undefined);
      assert.deepStrictEqual(
        message.blocks.map((block) =>
          JSON.stringify(block).includes('"type":"image"')
        ),
        [true]
      );
      assert.strictEqual(message.fields["text"], undefined);
    }).pipe(Effect.scoped)
  );

  it.live(
    "sends an upload's bytes only to Slack's upload origin, and posts nothing otherwise",
    () =>
      Effect.gen(function* elsewhere() {
        const image = testFile("image", 512);

        const { client, slack } = yield* onSlack({
          files: [image],
          uploads: "https://files.example.com",
        });

        assert.deepStrictEqual(
          yield* client
            .publish(yield* post({ media: [attached(image)] }))
            .pipe(Effect.flip),
          new PlatformUnavailable()
        );
        assert.deepStrictEqual(slack.files()[0]?.bytes, undefined);
        assert.deepStrictEqual(commits(slack), []);
      }).pipe(Effect.scoped)
  );

  it.live("refuses an image Slack's workspace takes no upload of", () =>
    Effect.gen(function* refused() {
      const image = testFile("image", 512);
      const { client, slack } = yield* onSlack({ files: [image] });

      slack.script("files.getUploadURLExternal", [
        slackError("file_uploads_disabled"),
      ]);

      assert.deepStrictEqual(
        yield* client
          .publish(yield* post({ media: [attached(image)] }))
          .pipe(Effect.flip),
        new MediaRejected({ code: "slack:file_uploads_disabled" })
      );
      assert.deepStrictEqual(commits(slack), []);
    }).pipe(Effect.scoped)
  );

  it.live("tries again later when Slack takes no upload's bytes", () =>
    Effect.gen(function* failed() {
      const image = testFile("image", 512);
      const { client, slack } = yield* onSlack({ files: [image] });

      slack.script("upload", [empty(500)]);

      assert.deepStrictEqual(
        yield* client
          .publish(yield* post({ media: [attached(image)] }))
          .pipe(Effect.flip),
        new PlatformUnavailable()
      );
      assert.deepStrictEqual(commits(slack), []);
    }).pipe(Effect.scoped)
  );

  it.live(
    "takes images Slack cannot show yet as Slack unavailable, nothing posted",
    () =>
      Effect.gen(function* notReady() {
        const image = testFile("image", 512);
        const { client, slack } = yield* onSlack({ files: [image] });

        slack.script("chat.postMessage", [slackError("invalid_blocks")]);

        assert.deepStrictEqual(
          yield* client
            .publish(yield* post({ media: [attached(image)] }))
            .pipe(Effect.flip),
          new PlatformUnavailable({ code: "slack:invalid_blocks" })
        );
        assert.deepStrictEqual(slack.messages(), []);
      }).pipe(Effect.scoped)
  );

  it.live("posts a later part in the thread of the first", () =>
    Effect.gen(function* thread() {
      const { client, slack } = yield* onSlack();

      const first = yield* client.publish(yield* post({ text: "Part one" }));

      assert(first._tag === "published");

      yield* client.publish(yield* post({ part: 1, text: "Part two" }));

      const reference = {
        parent: PlatformPostIdSchema.make(`${slackChannel}/1790000000.000002`),
        root: first.platformPostId,
      };

      const third = yield* client.publish(
        yield* post({
          part: 2,
          replyTo: Option.some(reference),
          text: "Part three",
        })
      );

      const last = slack.messages().at(2);

      assert.strictEqual(last?.threadTs, firstTs);
      assert.strictEqual(third._tag, "published");
    }).pipe(Effect.scoped)
  );

  it.live("never posts a message again when its answer is lost", () =>
    Effect.gen(function* lost() {
      for (const script of [
        { _tag: "postThenDrop" } as const,
        empty(502),
        slackError("internal_error"),
        slackError("fatal_error"),
      ]) {
        const { client, slack } = yield* onSlack();

        slack.script("chat.postMessage", [script]);

        const result = yield* client.publish(yield* post());

        assert.deepStrictEqual(result, {
          _tag: "unconfirmed",
          reason: "noResponse",
        });
        assert.strictEqual(commits(slack).length, 1);
      }
    }).pipe(Effect.scoped)
  );

  it.live(
    "leaves a message unconfirmed when Slack takes it and never answers",
    () =>
      Effect.gen(function* silence() {
        const { client, slack } = yield* onSlack({ timeout: "300 millis" });

        slack.script("chat.postMessage", [{ _tag: "hang" }]);

        const result = yield* client.publish(yield* post());

        assert.strictEqual(result._tag, "unconfirmed");
        assert.strictEqual(commits(slack).length, 1);
      }).pipe(Effect.scoped)
  );

  it.live("answers a resumed attempt unconfirmed, sending nothing", () =>
    Effect.gen(function* resumed() {
      const { client, slack } = yield* onSlack();

      const result = yield* client.resume(yield* post());

      assert.deepStrictEqual(result, {
        _tag: "unconfirmed",
        reason: "interrupted",
      });
      assert.deepStrictEqual(slack.requests(), []);
    }).pipe(Effect.scoped)
  );

  it.live("waits as long as a 429 asks, posting once", () =>
    Effect.gen(function* limited() {
      const { client, slack } = yield* onSlack();

      slack.script("chat.postMessage", [
        json({ error: "ratelimited", ok: false }, 429, { "retry-after": "30" }),
      ]);

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new RateLimited({ retryAfter: Duration.seconds(30) })
      );
      assert.strictEqual(commits(slack).length, 1);
    }).pipe(Effect.scoped)
  );

  it.live("takes a revoked token, or an app removed, as a refused token", () =>
    Effect.gen(function* revoked() {
      const { client, slack } = yield* onSlack({ api: { revoked: true } });

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new TokenExpired()
      );
      assert.deepStrictEqual(slack.messages(), []);
    }).pipe(Effect.scoped)
  );

  it.live(
    "refuses a channel the app is not in as cannotPost, which tells the member to invite it",
    () =>
      Effect.gen(function* outside() {
        const { client, slack } = yield* onSlack({
          api: { outsideChannel: true },
        });

        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new BadRequest({ code: "cannotPost" })
        );

        for (const code of [
          "is_archived",
          "channel_not_found",
          "restricted_action",
        ]) {
          slack.script("chat.postMessage", [slackError(code)]);

          assert.deepStrictEqual(
            yield* client.publish(yield* post()).pipe(Effect.flip),
            new BadRequest({ code: "cannotPost" })
          );
        }
      }).pipe(Effect.scoped)
  );

  it.live("keeps any other refusal by Slack's code, never its words", () =>
    Effect.gen(function* other() {
      const { client, slack } = yield* onSlack();

      slack.script("chat.postMessage", [
        slackError("msg_blocks_too_long"),
        json({ error: "Not a code: synthetic words", ok: false }),
      ]);

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new BadRequest({ code: "slack:msg_blocks_too_long" })
      );
      // An answer that is not Slack's own came from a server on the way:
      // the message may be there.
      assert.deepStrictEqual(yield* client.publish(yield* post()), {
        _tag: "unconfirmed",
        reason: "noResponse",
      });
    }).pipe(Effect.scoped)
  );

  it.live("publishes without a link when Slack gives none", () =>
    Effect.gen(function* noLink() {
      const { client, slack } = yield* onSlack();

      slack.script("chat.getPermalink", [empty(500)]);

      assert.deepStrictEqual(yield* client.publish(yield* post()), {
        _tag: "published",
        platformPostId: PlatformPostIdSchema.make(`${slackChannel}/${firstTs}`),
      });
    }).pipe(Effect.scoped)
  );
});
