import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { ChatPlatform } from "#shared/domain/platform.ts";

import type { ChatRefused } from "./chat-refused.ts";

/** What a member gives to connect a chat: its platform's secret. */
export type ChatSignIn =
  // A Discord channel, by its webhook's address.
  | { readonly platform: "discord"; readonly webhookUrl: Redacted.Redacted }
  // A Telegram channel or group, by the member's bot and the chat, its
  // public name (`@name`) or its id.
  | {
      readonly botToken: Redacted.Redacted;
      readonly chat: string;
      readonly platform: "telegram";
    };

/** The chat, as its platform describes it to the secret's holder. */
export interface VerifiedChat {
  /**
   * What tells one chat from another on the platform, so a workspace
   * connects each once: a Discord channel's `<guild>/<channel>`, a
   * Telegram chat's id.
   */
  readonly accountId: string;
  /** Its name. */
  readonly displayName: Option.Option<string>;
  /** How members tell it: a public name, or its name. */
  readonly handle: string;
  readonly platform: ChatPlatform;
  /**
   * What every call to it carries, kept as the channel's token: a
   * webhook's `<id>/<token>`, a bot's token.
   */
  readonly secret: Redacted.Redacted;
}

/**
 * Checks, on the chat's platform, that the secret posts in the chat,
 * before anything is kept. Nothing of the secret is logged or traced:
 * both platforms carry it in the path of their addresses.
 */
export class ChatVerifier extends Context.Service<
  ChatVerifier,
  {
    readonly verify: (
      signIn: ChatSignIn
    ) => Effect.Effect<VerifiedChat, ChatRefused | PlatformUnavailable>;
  }
>()("peal-server/channels/application/ChatVerifier") {}
