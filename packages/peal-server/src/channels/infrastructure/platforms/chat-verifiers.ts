import { Effect, Layer } from "effect";

import { ChatVerifier } from "#channels/application/chat-verifier.ts";
import type { DiscordHosts } from "#shared/infrastructure/platforms/discord-api.ts";
import type { TelegramHosts } from "#shared/infrastructure/platforms/telegram-api.ts";

import { discordWebhookVerify } from "./discord/discord-webhook-verifier.ts";
import { telegramChatVerify } from "./telegram/telegram-chat-verifier.ts";

/** Where the chats' APIs are. */
export interface ChatHosts {
  readonly discord: DiscordHosts;
  readonly telegram: TelegramHosts;
}

/**
 * ChatVerifier for every chat: a Discord webhook and a Telegram bot, each
 * on its own API, through the public HTTP client and the outbound guard.
 */
export const chatVerifiersLive = (hosts: ChatHosts) =>
  Layer.effect(
    ChatVerifier,
    Effect.gen(function* ChatVerifiersLive() {
      const discord = yield* discordWebhookVerify(hosts.discord);
      const telegram = yield* telegramChatVerify(hosts.telegram);

      return ChatVerifier.of({
        verify: (signIn) =>
          signIn.platform === "discord" ? discord(signIn) : telegram(signIn),
      });
    })
  );
