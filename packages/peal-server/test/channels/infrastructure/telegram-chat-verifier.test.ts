// A Telegram channel or group connects by the member's bot and the chat:
// Peal asks Telegram who the bot is, what the chat is, and whether the bot
// may post there, before anything is kept.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";

import { ChatRefused } from "#channels/application/chat-refused.ts";
import { telegramChatVerify } from "#channels/infrastructure/platforms/telegram/telegram-chat-verifier.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  fakeTelegramApi,
  postingChannel,
  telegramBotId,
  telegramBotToken,
  telegramChannelId,
} from "#test/publishing/fakes/fake-telegram-api.ts";
import type {
  FakeTelegramChat,
  FakeTelegramOptions,
} from "#test/publishing/fakes/fake-telegram-api.ts";
import { json } from "#test/publishing/fakes/platform-server.ts";

const Http = Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard);

const onTelegram = Effect.fn("test.onTelegram")(function* onTelegram(
  options: FakeTelegramOptions = {}
) {
  const telegram = yield* fakeTelegramApi(options);
  const verify = yield* telegramChatVerify({ api: telegram.url });

  return {
    telegram,
    verify: (chat: string, token = telegramBotToken) =>
      verify({ botToken: Redacted.make(token), chat, platform: "telegram" }),
  };
});

const bot = { id: telegramBotId, is_bot: true };

const group = (
  member: FakeTelegramChat["member"],
  type: FakeTelegramChat["type"] = "supergroup"
): FakeTelegramChat => ({
  id: -1_001_000_000_002,
  member,
  title: "Synthetic group",
  type,
});

layer(Http)("checking a Telegram bot and chat", (it) => {
  it.effect(
    "reads the chat the bot administers, by its public name or id",
    () =>
      Effect.gen(function* found() {
        const { telegram, verify } = yield* onTelegram();

        for (const asked of ["@synthetic_news", String(telegramChannelId)]) {
          const chat = yield* verify(asked);

          assert.strictEqual(chat.accountId, String(telegramChannelId));
          assert.strictEqual(chat.handle, "@synthetic_news");
          assert.deepStrictEqual(
            chat.displayName,
            Option.some("Synthetic announcements")
          );
          assert.strictEqual(Redacted.value(chat.secret), telegramBotToken);
        }

        assert.deepStrictEqual(
          telegram
            .requests()
            .slice(0, 3)
            .map(({ path }) => path.split("/").at(-1)),
          ["getMe", "getChat", "getChatMember"]
        );
      })
  );

  it.effect("names a chat without a public name by its title", () =>
    Effect.gen(function* titled() {
      const { verify } = yield* onTelegram({
        chats: [group({ status: "member", user: bot })],
      });

      assert.strictEqual(
        (yield* verify("-1001000000002")).handle,
        "Synthetic group"
      );
    })
  );

  it.effect("takes a group where the bot is a member, or may still send", () =>
    Effect.gen(function* groups() {
      for (const member of [
        { status: "member", user: bot },
        { status: "administrator", user: bot },
        { can_send_messages: true, status: "restricted", user: bot },
      ]) {
        const { verify } = yield* onTelegram({ chats: [group(member)] });

        assert.strictEqual(
          (yield* verify("-1001000000002")).accountId,
          "-1001000000002"
        );
      }
    })
  );

  it.effect("refuses a chat the bot may not post in", () =>
    Effect.gen(function* cannot() {
      for (const chat of [
        // In a channel, only an administrator with the right to post.
        { ...postingChannel, member: { status: "administrator", user: bot } },
        { ...postingChannel, member: { status: "member", user: bot } },
        group({ can_send_messages: false, status: "restricted", user: bot }),
        group({ status: "left", user: bot }),
        group({ status: "kicked", user: bot }),
      ]) {
        const { verify } = yield* onTelegram({ chats: [chat] });

        assert.deepStrictEqual(
          yield* verify(String(chat.id)).pipe(Effect.flip),
          new ChatRefused({ reason: "cannotPost" })
        );
      }
    })
  );

  it.effect("refuses a private chat with a person", () =>
    Effect.gen(function* person() {
      const { verify } = yield* onTelegram({
        chats: [group({ status: "member", user: bot }, "private")],
      });

      assert.deepStrictEqual(
        yield* verify("-1001000000002").pipe(Effect.flip),
        new ChatRefused({ reason: "chatKindNotSupported" })
      );
    })
  );

  it.effect("refuses a revoked token, and a chat Telegram does not know", () =>
    Effect.gen(function* refusals() {
      const revoked = yield* onTelegram({ revoked: true });

      assert.deepStrictEqual(
        yield* revoked.verify("@synthetic_news").pipe(Effect.flip),
        new ChatRefused({ reason: "credentialsRefused" })
      );

      const unknown = yield* onTelegram();

      assert.deepStrictEqual(
        yield* unknown.verify("@synthetic_other").pipe(Effect.flip),
        new ChatRefused({ reason: "chatNotFound" })
      );
    })
  );

  it.effect(
    "refuses a token or a chat of the wrong shape before any call",
    () =>
      Effect.gen(function* malformed() {
        const { telegram, verify } = yield* onTelegram();

        assert.deepStrictEqual(
          yield* verify("@synthetic_news", "synthetic/../getMe").pipe(
            Effect.flip
          ),
          new ChatRefused({ reason: "credentialsRefused" })
        );
        assert.deepStrictEqual(
          yield* verify("https://t.me/synthetic_news").pipe(Effect.flip),
          new ChatRefused({ reason: "chatNotFound" })
        );
        assert.deepStrictEqual(telegram.requests(), []);
      })
  );

  it.effect("takes flood control or a 5xx as Telegram unavailable", () =>
    Effect.gen(function* unavailable() {
      const { telegram, verify } = yield* onTelegram();

      telegram.script("getMe", [
        telegram.failed(429, "Too Many Requests", {
          parameters: { retry_after: 3 },
        }),
        json({ description: "Synthetic", error_code: 502, ok: false }, 502),
      ]);

      for (const _ of [1, 2]) {
        assert.deepStrictEqual(
          yield* verify("@synthetic_news").pipe(Effect.flip),
          new PlatformUnavailable()
        );
      }
    })
  );
});
