import { Schema } from "effect";

/**
 * A chat would not be connected, for a reason its member can fix:
 *
 * - `addressNotAWebhook`: the address is not a Discord webhook's.
 * - `webhookNotFound`: Discord has no such webhook (deleted, or its token
 *   regenerated).
 * - `webhookKindNotSupported`: the webhook is not an incoming one, which
 *   posts messages (a channel follower's or an application's).
 * - `credentialsRefused`: Telegram refused the bot's token.
 * - `chatNotFound`: Telegram knows no such chat, or the bot is not in it.
 * - `chatKindNotSupported`: the chat is a private chat with a person.
 * - `cannotPost`: the bot is in the chat without the right to post there.
 */
export class ChatRefused extends Schema.TaggedError<ChatRefused>()(
  "ChatRefused",
  {
    reason: Schema.Literals([
      "addressNotAWebhook",
      "webhookNotFound",
      "webhookKindNotSupported",
      "credentialsRefused",
      "chatNotFound",
      "chatKindNotSupported",
      "cannotPost",
    ]),
  }
) {}
