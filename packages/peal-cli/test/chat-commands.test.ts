import { assert, describe, it } from "@effect/vitest";
import { Effect, Ref } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";

const inStudio = ["--workspace", "studio"];

const webhook =
  "https://discord.com/api/webhooks/400000000000000001/synthetic-webhook-token";

const botToken = "100001:synthetic-bot-token";

describe("peal channels connect-chat", () => {
  it.effect(
    "connects a Discord channel with the webhook piped in, never shown",
    () =>
      Effect.gen(function* discord() {
        const session = yield* signedIn();

        const printed = yield* session
          .piping(`${webhook}\n`)
          .printed([
            "channels",
            "connect-chat",
            "--platform",
            "discord",
            ...inStudio,
          ]);

        assert.include(
          printed,
          "Connected Synthetic news (Synthetic news) to Studio"
        );
        assert.notInclude(printed, "synthetic-webhook-token");

        const { changes } = yield* Ref.get(session.studio.state);

        assert.include(changes, `chat:discord:${webhook}`);
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("connects a Telegram chat with the bot's token piped in", () =>
    Effect.gen(function* telegram() {
      const session = yield* signedIn();

      const printed = yield* session
        .piping(`${botToken}\n`)
        .printed([
          "channels",
          "connect-chat",
          "--platform",
          "telegram",
          "--chat",
          "@synthetic_news",
          ...inStudio,
        ]);

      assert.include(printed, "Connected");
      assert.notInclude(printed, botToken);

      const { changes } = yield* Ref.get(session.studio.state);

      assert.include(changes, `chat:telegram:@synthetic_news:${botToken}`);
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("asks Telegram's chat before anything is sent", () =>
    Effect.gen(function* withoutChat() {
      const session = yield* signedIn();

      const errors = yield* session
        .piping(`${botToken}\n`)
        .refused([
          "channels",
          "connect-chat",
          "--platform",
          "telegram",
          ...inStudio,
        ]);

      assert.include(errors, "--chat");

      const { changes } = yield* Ref.get(session.studio.state);

      assert.isFalse(changes.some((change) => change.startsWith("chat:")));
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("says why the platform refused, and saves nothing", () =>
    Effect.gen(function* refused() {
      const session = yield* signedIn();

      const errors = yield* session
        .piping("https://example.com/synthetic-not-a-webhook\n")
        .refused([
          "channels",
          "connect-chat",
          "--platform",
          "discord",
          ...inStudio,
        ]);

      assert.include(
        errors,
        "The chat was not connected: the address is not a Discord webhook's"
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
