import { Context, Schema } from "effect";
import type { Effect } from "effect";

import { ChannelUnreadable } from "#engagement/application/channel-unreadable.ts";
import { MessagesUngranted } from "#engagement/application/messages-ungranted.ts";
import { ConversationReadingSchema } from "#engagement/domain/conversation.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";

/**
 * A channel whose conversations to read, by id: those with a message
 * since `keptSince`, the oldest Peal may keep. Ids and an instant only:
 * what the channel holds stays in engagement's tables.
 */
export const MessagesRequestSchema = Schema.Struct({
  channelId: ChannelIdSchema,
  keptSince: Schema.DateTimeUtc,
});

export type MessagesRequest = typeof MessagesRequestSchema.Type;

/**
 * What a read of a channel's conversations found: those new or changed
 * since Peal last read them, each with its messages back to `keptSince`.
 * A conversation that did not change, and was read back whole in the last
 * day, is not in it. `halted` when the read
 * stopped before it listed every conversation (the platform asked to slow
 * down, or the read's time ran out): the next run goes on.
 */
export const MessagesBatchSchema = Schema.Struct({
  conversations: Schema.Array(ConversationReadingSchema),
  halted: Schema.Boolean,
  // Every conversation the listing showed, by its id on the platform, and
  // whether that is all the platform has back to `keptSince`: a kept
  // conversation a whole listing no longer shows was deleted there.
  listed: Schema.Array(Schema.String),
  listedWhole: Schema.Boolean,
});

export type MessagesBatch = typeof MessagesBatchSchema.Type;

/**
 * Why nothing was read: the channel, its account no longer granting what
 * reading takes, the platform being down, or the platform asking to slow
 * down.
 */
export const MessagesReadFailureSchema = Schema.Union([
  ChannelUnreadable,
  MessagesUngranted,
  PlatformUnavailable,
  RateLimited,
]);

export type MessagesReadFailure = typeof MessagesReadFailureSchema.Type;

/** A channel whose platform to ask, or tell, about the account's events. */
export const MessagesFollowRequestSchema = Schema.Struct({
  channelId: ChannelIdSchema,
});

export type MessagesFollowRequest = typeof MessagesFollowRequestSchema.Type;

/**
 * How asking a platform to tell the server of an account's messages, or
 * to stop, ended: done, or not needed, as the platform tells nothing (it
 * is read on a schedule alone) or, to stop, another channel of Peal's
 * still follows the account.
 */
export const MessagesFollowOutcomeSchema = Schema.Literals([
  "done",
  "unneeded",
]);

export type MessagesFollowOutcome = typeof MessagesFollowOutcomeSchema.Type;

/**
 * Reads a channel's conversations on its platform, and asks the platform
 * to tell the server when something changes there (`follow`, before a
 * read, as a platform may drop the subscription) or to stop (`unfollow`,
 * before its messages are turned off). The platform's reader does it; the
 * collection runs it through the channel's gate, one call at a time with
 * the channel's publishing.
 */
export class MessageSource extends Context.Service<
  MessageSource,
  {
    readonly read: (
      request: MessagesRequest
    ) => Effect.Effect<MessagesBatch, MessagesReadFailure>;
    readonly follow: (
      request: MessagesFollowRequest
    ) => Effect.Effect<MessagesFollowOutcome, MessagesReadFailure>;
    readonly unfollow: (
      request: MessagesFollowRequest
    ) => Effect.Effect<MessagesFollowOutcome, MessagesReadFailure>;
  }
>()("peal-server/engagement/application/MessageSource") {}
