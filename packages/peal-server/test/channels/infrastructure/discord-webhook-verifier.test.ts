// A Discord channel connects by its webhook's address: Peal reads the
// webhook on Discord's own API before anything is kept, and refuses an
// address that is not a webhook's before any request leaves.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";

import { ChatRefused } from "#channels/application/chat-refused.ts";
import { discordWebhookVerify } from "#channels/infrastructure/platforms/discord/discord-webhook-verifier.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  discordAccount,
  discordSecret,
  discordWebhookId,
  discordWebhookToken,
  fakeDiscordApi,
} from "#test/publishing/fakes/fake-discord-api.ts";
import type { FakeDiscordOptions } from "#test/publishing/fakes/fake-discord-api.ts";
import { empty, json } from "#test/publishing/fakes/platform-server.ts";

const Http = Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard);

const address = `https://discord.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`;

const onDiscord = Effect.fn("test.onDiscord")(function* onDiscord(
  options: FakeDiscordOptions = {}
) {
  const discord = yield* fakeDiscordApi(options);
  const verify = yield* discordWebhookVerify({ api: discord.url });

  return {
    discord,
    verify: (webhookUrl: string) =>
      verify({ platform: "discord", webhookUrl: Redacted.make(webhookUrl) }),
  };
});

layer(Http)("checking a Discord webhook", (it) => {
  it.effect(
    "reads the webhook's guild and channel, and keeps its id and token",
    () =>
      Effect.gen(function* found() {
        const { discord, verify } = yield* onDiscord();

        const chat = yield* verify(address);

        assert.strictEqual(chat.accountId, discordAccount);
        assert.strictEqual(chat.platform, "discord");
        assert.strictEqual(chat.handle, "Synthetic announcements");
        assert.deepStrictEqual(
          chat.displayName,
          Option.some("Synthetic announcements")
        );
        assert.strictEqual(Redacted.value(chat.secret), discordSecret);

        const [call] = discord.requests();

        assert.strictEqual(call?.method, "GET");
        assert.strictEqual(call?.path, discord.webhookPath);
      })
  );

  it.effect("takes the older host, and an address with the API's version", () =>
    Effect.gen(function* forms() {
      const { verify } = yield* onDiscord();

      for (const written of [
        `https://discordapp.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`,
        `https://discord.com/api/v10/webhooks/${discordWebhookId}/${discordWebhookToken}`,
        `  ${address}/ `,
      ]) {
        assert.strictEqual((yield* verify(written)).accountId, discordAccount);
      }
    })
  );

  it.effect(
    "refuses an address that is not a webhook's before any request",
    () =>
      Effect.gen(function* refused() {
        const { discord, verify } = yield* onDiscord();

        for (const written of [
          `https://example.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`,
          `https://discord.com.example.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`,
          `https://user@discord.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`,
          `http://discord.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}`,
          `https://discord.com:8443/api/webhooks/${discordWebhookId}/${discordWebhookToken}`,
          `https://discord.com/api/channels/${discordWebhookId}/${discordWebhookToken}`,
          `https://discord.com/api/webhooks/${discordWebhookId}/${discordWebhookToken}?wait=true`,
          `https://discord.com/api/webhooks/${discordWebhookId}/../synthetic`,
          "synthetic-not-an-address",
        ]) {
          assert.deepStrictEqual(
            yield* verify(written).pipe(Effect.flip),
            new ChatRefused({ reason: "addressNotAWebhook" })
          );
        }

        assert.deepStrictEqual(discord.requests(), []);
      })
  );

  it.effect("says a deleted webhook, or a wrong token, is not found", () =>
    Effect.gen(function* gone() {
      const deleted = yield* onDiscord({ gone: true });

      assert.deepStrictEqual(
        yield* deleted.verify(address).pipe(Effect.flip),
        new ChatRefused({ reason: "webhookNotFound" })
      );

      const other = yield* onDiscord();

      assert.deepStrictEqual(
        yield* other
          .verify(
            `https://discord.com/api/webhooks/${discordWebhookId}/synthetic-other`
          )
          .pipe(Effect.flip),
        new ChatRefused({ reason: "webhookNotFound" })
      );
    })
  );

  it.effect("refuses a webhook that is not an incoming one", () =>
    Effect.gen(function* follower() {
      const { verify } = yield* onDiscord({ type: 2 });

      assert.deepStrictEqual(
        yield* verify(address).pipe(Effect.flip),
        new ChatRefused({ reason: "webhookKindNotSupported" })
      );
    })
  );

  it.effect(
    "takes a refusal without Discord's JSON, or a 5xx, as Discord unavailable",
    () =>
      Effect.gen(function* unavailable() {
        const { discord, verify } = yield* onDiscord();

        discord.script(`GET ${discord.webhookPath}`, [
          empty(404),
          json({ message: "Synthetic outage" }, 502),
          json({ message: "You are being rate limited.", retry_after: 1 }, 429),
        ]);

        for (const _ of [1, 2, 3]) {
          assert.deepStrictEqual(
            yield* verify(address).pipe(Effect.flip),
            new PlatformUnavailable()
          );
        }
      })
  );

  it.effect(
    "keeps a webhook's name clean of NUL and half a surrogate pair",
    () =>
      Effect.gen(function* name() {
        const { verify } = yield* onDiscord({
          name: "Synthetic\u0000 news\uD800",
        });

        const chat = yield* verify(address);

        // The verifier hands the name on as Discord gave it; the use case
        // makes it storable (connect-chat.test.ts).
        assert.strictEqual(chat.handle, "Synthetic\u0000 news\uD800");
      })
  );
});
