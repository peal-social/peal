import { Context, Schema } from "effect";
import type { Effect } from "effect";

import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";
import type { PrivateReplyOutcome } from "#engagement/domain/private-reply.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";

export { PrivateReplyOutcomeSchema } from "#engagement/domain/private-reply.ts";

export type { PrivateReplyOutcome } from "#engagement/domain/private-reply.ts";

/** A private reply to send, by id: its text stays in the engagement tables. */
export const PrivateReplyRequestSchema = Schema.Struct({
  channelId: ChannelIdSchema,
  privateReplyId: PrivateReplyIdSchema,
});

export type PrivateReplyRequest = typeof PrivateReplyRequestSchema.Type;

/**
 * Sends a private reply as the channel's account, through the channel's
 * gate: one call at a time with its publishing.
 *
 * `send` makes the one request that puts it out; `resume` is for one an
 * earlier run may already have sent, and never sends: it looks for it in
 * the person's conversation, and answers `unconfirmed` when it cannot
 * tell. Neither fails: every ending is a `PrivateReplyOutcome`.
 */
export class PrivateReplySender extends Context.Service<
  PrivateReplySender,
  {
    readonly send: (
      request: PrivateReplyRequest
    ) => Effect.Effect<PrivateReplyOutcome>;
    readonly resume: (
      request: PrivateReplyRequest
    ) => Effect.Effect<PrivateReplyOutcome>;
  }
>()("peal-server/engagement/application/PrivateReplySender") {}
