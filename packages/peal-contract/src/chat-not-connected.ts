import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why a chat was not connected, for clients to explain:
 *
 * - `addressNotAWebhook`: the address is not a Discord webhook's, as a
 *   channel's settings give it (Integrations, Webhooks, Copy Webhook URL).
 * - `webhookNotFound`: Discord has no such webhook: it was deleted, or its
 *   address changed.
 * - `webhookKindNotSupported`: the webhook does not post messages (a
 *   channel follower's or an application's): make an incoming one.
 * - `credentialsRefused`: Telegram refused the bot's token.
 * - `chatNotFound`: Telegram knows no such chat, or the bot is not in it.
 * - `chatKindNotSupported`: the chat is a private chat with a person;
 *   Peal posts in channels and groups.
 * - `cannotPost`: the bot is in the chat without the right to post there:
 *   in a channel, make it an administrator who may post messages.
 */
export const ChatNotConnectedReasonSchema = Schema.Literals([
  "addressNotAWebhook",
  "webhookNotFound",
  "webhookKindNotSupported",
  "credentialsRefused",
  "chatNotFound",
  "chatKindNotSupported",
  "cannotPost",
]).annotate({ identifier: "ChatNotConnectedReason" });

export type ChatNotConnectedReason = typeof ChatNotConnectedReasonSchema.Type;

/** The chat was not connected. */
export class ChatNotConnected extends Schema.TaggedError<ChatNotConnected>()(
  "ChatNotConnected",
  { ...errorEnvelope, reason: ChatNotConnectedReasonSchema },
  {
    description:
      "The chat was not connected; `reason` says why. Nothing was saved.",
    httpApiStatus: 422,
  }
) {}
