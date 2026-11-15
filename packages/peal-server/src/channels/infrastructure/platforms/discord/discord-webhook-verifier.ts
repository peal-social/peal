import { Effect, Option, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import { ChatRefused } from "#channels/application/chat-refused.ts";
import type {
  ChatSignIn,
  VerifiedChat,
} from "#channels/application/chat-verifier.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  discordCodeOf,
  discordCodes,
  discordUserAgent,
  webhookOfAddress,
  webhookSecretOf,
  webhookUrl,
} from "#shared/infrastructure/platforms/discord-api.ts";
import type { DiscordHosts } from "#shared/infrastructure/platforms/discord-api.ts";
import {
  publicHttpClient,
  untraced,
} from "#shared/infrastructure/platforms/public-http.ts";

// Get Webhook with Token (docs.discord.com/developers/resources/webhook,
// read 2026-11-16): no authentication but the token; `type` 1 is an
// incoming webhook, which posts messages (2 is a channel follower's, 3 an
// application's).
const WebhookSchema = Schema.Struct({
  channel_id: Schema.NullOr(
    Schema.String.check(Schema.isPattern(/^\d{1,20}$/u))
  ),
  guild_id: Schema.optionalKey(
    Schema.NullOr(Schema.String.check(Schema.isPattern(/^\d{1,20}$/u)))
  ),
  name: Schema.NullOr(Schema.String),
  type: Schema.Int,
});

const incoming = 1;

/**
 * How `ChatVerifier` checks a Discord webhook: an address that is not a
 * webhook's is refused before any call (`addressNotAWebhook`); then the
 * webhook is read on Discord's own API, whatever host the address named.
 * Discord's unknown webhook or invalid token (on a 401 or a 404, with its
 * JSON) is `webhookNotFound`; a webhook that is not an incoming one, or
 * belongs to no guild channel, `webhookKindNotSupported`. The channel is
 * the guild's channel (`<guild>/<channel>`), so another webhook of the
 * same channel reconnects it; its name is the webhook's. Anything else
 * (a 5xx, a 429, no answer) is Discord unavailable. The token is in the
 * address's path: the request makes no span, and its errors are typed
 * here.
 */
export const discordWebhookVerify = Effect.fnUntraced(
  function* discordWebhookVerify(hosts: DiscordHosts) {
    const http = untraced(yield* publicHttpClient);

    return Effect.fn("DiscordWebhookVerifier.verify")(function* verify(
      signIn: Extract<ChatSignIn, { readonly platform: "discord" }>
    ) {
      const webhook = webhookOfAddress(signIn.webhookUrl);

      if (Option.isNone(webhook)) {
        return yield* new ChatRefused({ reason: "addressNotAWebhook" });
      }

      const response = yield* http
        .execute(
          HttpClientRequest.get(webhookUrl(hosts, webhook.value)).pipe(
            HttpClientRequest.setHeader("user-agent", discordUserAgent)
          )
        )
        .pipe(Effect.mapError(() => new PlatformUnavailable()));

      if (response.status === 401 || response.status === 404) {
        const code = yield* discordCodeOf(response);

        return yield* Option.exists(
          code,
          (found) =>
            found === discordCodes.unknownWebhook ||
            found === discordCodes.invalidWebhookToken
        )
          ? new ChatRefused({ reason: "webhookNotFound" })
          : new PlatformUnavailable();
      }

      if (response.status !== 200) {
        return yield* new PlatformUnavailable();
      }

      const found = yield* HttpClientResponse.schemaBodyJson(WebhookSchema)(
        response
      ).pipe(Effect.mapError(() => new PlatformUnavailable()));

      const guild = Option.fromNullishOr(found.guild_id);
      const channel = Option.fromNullishOr(found.channel_id);

      if (
        found.type !== incoming ||
        Option.isNone(guild) ||
        Option.isNone(channel)
      ) {
        return yield* new ChatRefused({ reason: "webhookKindNotSupported" });
      }

      const name = Option.fromNullishOr(found.name).pipe(
        Option.filter((written) => written.trim() !== "")
      );

      const chat: VerifiedChat = {
        accountId: `${guild.value}/${channel.value}`,
        displayName: name,
        handle: Option.getOrElse(name, () => `#${channel.value}`),
        platform: "discord",
        secret: webhookSecretOf(webhook.value),
      };

      return chat;
    });
  }
);
