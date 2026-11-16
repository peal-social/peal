import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Option } from "effect";

import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { TelegramOptions } from "#publishing/domain/telegram-options.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import {
  fakeTelegramApi,
  postingChannel,
  telegramAccount,
  telegramBotToken,
  telegramChannelId,
} from "#test/publishing/fakes/fake-telegram-api.ts";
import type {
  FakeTelegramChat,
  FakeTelegramOptions,
} from "#test/publishing/fakes/fake-telegram-api.ts";

import {
  attached,
  credentialsOf,
  httpClientTimingOutAfter,
  outgoing,
  telegramClientWith,
  testFile,
} from "./support.ts";
import type { TestFile } from "./support.ts";

const onTelegram = Effect.fn("test.onTelegram")(function* onTelegram(
  options: {
    readonly api?: FakeTelegramOptions;
    readonly files?: readonly TestFile[];
    readonly token?: string;
    readonly timeout?: Duration.Input;
  } = {}
) {
  const telegram = yield* fakeTelegramApi(options.api);

  const credentials = credentialsOf(
    { accountId: telegramAccount, platform: "telegram" },
    [options.token ?? telegramBotToken]
  );

  const client = yield* telegramClientWith({
    api: telegram.url,
    credentials,
    files: options.files ?? [],
    http:
      options.timeout === undefined
        ? undefined
        : yield* httpClientTimingOutAfter(options.timeout),
  });

  return { client, telegram };
});

const post = (fields: Partial<OutgoingPost> = {}) =>
  outgoing({ ...fields, accountId: telegramAccount });

const withOptions = (
  fields: ConstructorParameters<typeof TelegramOptions>[0]
) => Option.some(new TelegramOptions(fields));

describe("publishing in a Telegram chat through the member's bot", () => {
  it.live("sends a text as a message, in plain text, and links to it", () =>
    Effect.gen(function* text() {
      const { client, telegram } = yield* onTelegram();

      const result = yield* client.publish(
        yield* post({ text: "Synthetic *news* at https://example.com" })
      );

      const [call] = telegram.calls("sendMessage");

      assert(call !== undefined);
      assert.deepStrictEqual(result, {
        _tag: "published",
        permalink: "https://t.me/synthetic_news/1",
        platformPostId: PlatformPostIdSchema.make("t:1"),
      });
      assert.deepStrictEqual(telegram.messages()[0]?.fields, {
        chat_id: telegramAccount,
        text: "Synthetic *news* at https://example.com",
      });
    }).pipe(Effect.scoped)
  );

  it.live(
    "sends silently and without a link's preview, as the options say",
    () =>
      Effect.gen(function* options() {
        const { client, telegram } = yield* onTelegram();

        yield* client.publish(
          yield* post({
            options: withOptions({ linkPreview: false, silent: true }),
          })
        );

        assert.deepStrictEqual(telegram.messages()[0]?.fields, {
          chat_id: telegramAccount,
          disable_notification: true,
          link_preview_options: { is_disabled: true },
          text: "Hello from a synthetic account",
        });
      }).pipe(Effect.scoped)
  );

  it.live("sends a photo with its caption, uploaded in the request", () =>
    Effect.gen(function* photo() {
      const image = testFile("image", 2048);
      const { client, telegram } = yield* onTelegram({ files: [image] });

      const result = yield* client.publish(
        yield* post({ media: [attached(image)], text: "A caption" })
      );

      const [message] = telegram.messages();

      assert(message !== undefined);
      assert.strictEqual(message.method, "sendPhoto");
      assert.deepStrictEqual(message.fields, {
        caption: "A caption",
        chat_id: telegramAccount,
      });
      assert.deepStrictEqual(
        message.files.map(({ data, name }) => [name, data]),
        [["photo", image.bytes]]
      );
      assert.deepStrictEqual(
        result._tag === "published" ? result.platformPostId : undefined,
        PlatformPostIdSchema.make("m:1")
      );
    }).pipe(Effect.scoped)
  );

  it.live("sends a GIF as an animation, and a video for streaming", () =>
    Effect.gen(function* single() {
      const gif = testFile("image", 1024, "image/gif");
      const video = testFile("video", 4096);
      const { client, telegram } = yield* onTelegram({ files: [gif, video] });

      yield* client.publish(yield* post({ media: [attached(gif)], text: "" }));
      yield* client.publish(
        yield* post({ media: [attached(video)], text: "A clip" })
      );

      const [animation, clip] = telegram.messages();

      assert.strictEqual(animation?.method, "sendAnimation");
      assert.deepStrictEqual(animation?.fields, { chat_id: telegramAccount });
      assert.deepStrictEqual(
        animation?.files.map(({ name }) => name),
        ["animation"]
      );
      assert.strictEqual(clip?.method, "sendVideo");
      assert.deepStrictEqual(clip?.fields, {
        caption: "A clip",
        chat_id: telegramAccount,
        duration: "4",
        height: "600",
        supports_streaming: "true",
        width: "800",
      });
    }).pipe(Effect.scoped)
  );

  it.live(
    "sends several files as an album, the text the first one's caption",
    () =>
      Effect.gen(function* album() {
        const image = testFile("image", 2048);
        const video = testFile("video", 4096);

        const { client, telegram } = yield* onTelegram({
          files: [image, video],
        });

        const result = yield* client.publish(
          yield* post({
            media: [attached(image), attached(video)],
            text: "An album",
          })
        );

        const [first] = telegram.messages();

        assert(first !== undefined);
        assert.strictEqual(first.method, "sendMediaGroup");
        assert.deepStrictEqual(first.fields["media"], [
          { caption: "An album", media: "attach://file0", type: "photo" },
          {
            duration: 4,
            height: 600,
            media: "attach://file1",
            supports_streaming: true,
            type: "video",
            width: 800,
          },
        ]);
        assert.deepStrictEqual(
          first.files.map(({ data, name }) => [name, data]),
          [
            ["file0", image.bytes],
            ["file1", video.bytes],
          ]
        );
        // Every message of the album, the captioned one first.
        assert.deepStrictEqual(
          result._tag === "published" ? result.platformPostId : undefined,
          PlatformPostIdSchema.make("m:1,2")
        );
      }).pipe(Effect.scoped)
  );

  it.live("replies to the part before, by its first message", () =>
    Effect.gen(function* parts() {
      const image = testFile("image", 2048);
      const { client, telegram } = yield* onTelegram({ files: [image] });

      const first = yield* client.publish(yield* post({ text: "One" }));

      assert(first._tag === "published");

      const second = yield* client.publish(
        yield* post({
          media: [attached(image)],
          part: 1,
          replyTo: Option.some({
            parent: first.platformPostId,
            root: first.platformPostId,
          }),
          text: "Two",
        })
      );

      assert(second._tag === "published");

      yield* client.publish(
        yield* post({
          part: 2,
          replyTo: Option.some({
            parent: second.platformPostId,
            root: first.platformPostId,
          }),
          text: "Three",
        })
      );

      assert.deepStrictEqual(
        telegram.messages().map(({ fields }) => fields["reply_parameters"]),
        [undefined, { message_id: 1 }, { message_id: 2 }]
      );
    }).pipe(Effect.scoped)
  );

  it.live("links to nothing in a chat without a public name", () =>
    Effect.gen(function* privateChat() {
      const group: FakeTelegramChat = {
        id: postingChannel.id,
        member: postingChannel.member,
        title: "A synthetic group",
        type: "supergroup",
      };

      const { client } = yield* onTelegram({ api: { chats: [group] } });

      assert.deepStrictEqual(yield* client.publish(yield* post()), {
        _tag: "published",
        platformPostId: PlatformPostIdSchema.make("t:1"),
      });
    }).pipe(Effect.scoped)
  );

  it.live("never sends a message again when its answer is lost", () =>
    Effect.gen(function* lost() {
      for (const script of [
        { _tag: "sendThenDrop" } as const,
        { _tag: "answer", body: { ok: false }, status: 502 } as const,
      ]) {
        const { client, telegram } = yield* onTelegram();

        telegram.script("sendMessage", [script]);

        assert.strictEqual(
          (yield* client.publish(yield* post()))._tag,
          "unconfirmed"
        );
        assert.lengthOf(telegram.calls("sendMessage"), 1);
      }
    }).pipe(Effect.scoped)
  );

  it.live("leaves a message unconfirmed when Telegram never answers", () =>
    Effect.gen(function* silence() {
      const { client, telegram } = yield* onTelegram({ timeout: "300 millis" });

      telegram.script("sendMessage", [{ _tag: "hang" }]);

      assert.strictEqual(
        (yield* client.publish(yield* post()))._tag,
        "unconfirmed"
      );
      assert.lengthOf(telegram.calls("sendMessage"), 1);
    }).pipe(Effect.scoped)
  );

  it.live("answers a resumed attempt unconfirmed, sending nothing", () =>
    Effect.gen(function* resumed() {
      const { client, telegram } = yield* onTelegram();

      assert.deepStrictEqual(yield* client.resume(yield* post()), {
        _tag: "unconfirmed",
        reason: "interrupted",
      });
      assert.deepStrictEqual(telegram.requests(), []);
    }).pipe(Effect.scoped)
  );

  it.live("waits as long as flood control asks, sending once", () =>
    Effect.gen(function* limited() {
      const { client, telegram } = yield* onTelegram();

      telegram.script("sendMessage", [
        telegram.failed(429, "Too Many Requests: retry after 7", {
          parameters: { retry_after: 7 },
        }),
      ]);

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new RateLimited({ retryAfter: Duration.seconds(7) })
      );
      assert.lengthOf(telegram.calls("sendMessage"), 1);
    }).pipe(Effect.scoped)
  );

  it.live(
    "takes a revoked token, or a bot removed from the chat, as a refused token",
    () =>
      Effect.gen(function* refused() {
        const revoked = yield* onTelegram({ api: { revoked: true } });

        assert.deepStrictEqual(
          yield* revoked.client.publish(yield* post()).pipe(Effect.flip),
          new TokenExpired()
        );
        assert.lengthOf(revoked.telegram.requests(), 1);

        const removed = yield* onTelegram();

        removed.telegram.script("sendMessage", [
          removed.telegram.failed(403, "Forbidden: bot is not a member"),
        ]);

        assert.deepStrictEqual(
          yield* removed.client.publish(yield* post()).pipe(Effect.flip),
          new TokenExpired()
        );
      }).pipe(Effect.scoped)
  );

  it.live(
    "tells a group that became a supergroup, and other refusals, by their codes",
    () =>
      Effect.gen(function* refusals() {
        const { client, telegram } = yield* onTelegram();

        telegram.script("sendMessage", [
          telegram.failed(400, "Bad Request: group chat was upgraded", {
            parameters: { migrate_to_chat_id: -1_001_000_000_009 },
          }),
          telegram.failed(400, "Bad Request: synthetic"),
          telegram.failed(413, "Request Entity Too Large"),
        ]);

        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new BadRequest({ code: "chatMigrated" })
        );
        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new BadRequest({ code: "telegram400" })
        );
        assert.deepStrictEqual(
          yield* client.publish(yield* post()).pipe(Effect.flip),
          new MediaRejected({ code: "tooLarge" })
        );
      }).pipe(Effect.scoped)
  );

  it.live("sends nothing for a token that is not a bot's", () =>
    Effect.gen(function* invalid() {
      const { client, telegram } = yield* onTelegram({
        token: "synthetic/../not-a-token",
      });

      assert.deepStrictEqual(
        yield* client.publish(yield* post()).pipe(Effect.flip),
        new BadRequest({ code: "invalidCredential" })
      );
      assert.deepStrictEqual(telegram.requests(), []);
    }).pipe(Effect.scoped)
  );

  it.live("posts in the chat its account names", () =>
    Effect.gen(function* chat() {
      const { client, telegram } = yield* onTelegram();

      yield* client.publish(yield* post());

      assert.strictEqual(telegram.messages()[0]?.chatId, telegramChannelId);
    }).pipe(Effect.scoped)
  );
});
