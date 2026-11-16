import { Context } from "effect";
import type { DateTime, Effect, Option } from "effect";

import type { CommentId } from "#engagement/domain/comment-id.ts";
import type { PrivateReplyId } from "#engagement/domain/private-reply-id.ts";
import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelId } from "#shared/domain/ids.ts";

/** An idempotency key, and since when a use of it still counts. */
export interface PrivateReplyKey {
  readonly key: string;
  readonly since: DateTime.Utc;
}

/**
 * What journalling a private reply came to: `journalled`; `replayed`, the
 * key made this very reply before (it is answered as it stands);
 * `keyReused`, the key made another; `pending`, the comment has one on
 * its way, unconfirmed or sent; `dropped`, the comment, or the channel's
 * messages, went meanwhile.
 */
export type PrivateReplyJournalled =
  | { readonly _tag: "journalled" }
  | { readonly _tag: "replayed"; readonly reply: PrivateReply }
  | { readonly _tag: "keyReused" }
  | { readonly _tag: "pending"; readonly privateReplyId: PrivateReplyId }
  | { readonly _tag: "dropped" };

/**
 * Where private replies are kept (`engagement.private_replies`). The
 * database decides what may be journalled: one private reply a comment
 * while it is on its way, unconfirmed or sent, and one a key in the
 * workspace.
 */
export class PrivateReplyStore extends Context.Service<
  PrivateReplyStore,
  {
    /**
     * Journals a private reply about to be sent: inserts only, under the
     * channel's message box, which every deletion of the channel's
     * messages takes first. Dropped when the comment is gone from the
     * reply's workspace, or the channel's messages are off.
     */
    readonly journal: (
      reply: PrivateReply,
      key: Option.Option<PrivateReplyKey>
    ) => Effect.Effect<PrivateReplyJournalled, DatabaseError>;
    /**
     * What a key made in the workspace since `key.since`, compared with
     * `reply`. Reads only.
     */
    readonly madeWithKey: (
      reply: PrivateReply,
      key: PrivateReplyKey
    ) => Effect.Effect<Option.Option<PrivateReplyJournalled>, DatabaseError>;
    readonly privateReply: (
      privateReplyId: string
    ) => Effect.Effect<Option.Option<PrivateReply>, DatabaseError>;
    /** The private replies to the comments, oldest first, in one query. */
    readonly ofComments: (
      commentIds: readonly CommentId[]
    ) => Effect.Effect<readonly PrivateReply[], DatabaseError>;
    /**
     * Moves a private reply from the status it was read in, attempt
     * included, to `next`. False when it moved meanwhile.
     */
    readonly advance: (
      next: PrivateReply,
      from: PrivateReply
    ) => Effect.Effect<boolean, DatabaseError>;
    /**
     * Records that a gate is about to call the platform for it, only while
     * it is on its way. False otherwise: nothing is sent.
     */
    readonly claimCall: (
      privateReplyId: PrivateReplyId,
      at: DateTime.Utc
    ) => Effect.Effect<boolean, DatabaseError>;
    /**
     * At most `limit` private replies still on their way, written by
     * `writtenBefore`, with no call claimed after `calledBefore`.
     */
    readonly stranded: (
      writtenBefore: DateTime.Utc,
      calledBefore: DateTime.Utc,
      limit: number
    ) => Effect.Effect<readonly PrivateReply[], DatabaseError>;
    /**
     * Deletes the channel's private replies that never set out (on their
     * way, no call begun), under its box, locked until the caller's
     * transaction ends, and answers them: their outbound messages are
     * given back. Those that may have gone out stay until their purge.
     */
    readonly dropUnsent: (
      channelId: ChannelId
    ) => Effect.Effect<readonly PrivateReply[], DatabaseError>;
    /**
     * The platform's ids of the channel's messages Peal sent as its
     * account, private replies and direct messages: a resumed private
     * reply never takes one of them for its own.
     */
    readonly sentIdsOf: (
      channelId: ChannelId,
      except: PrivateReplyId
    ) => Effect.Effect<readonly string[], DatabaseError>;
    /** Deletes, `limit` at most, those settled before `keptSince`. */
    readonly purge: (
      keptSince: DateTime.Utc,
      limit: number
    ) => Effect.Effect<number, DatabaseError>;
  }
>()("peal-server/engagement/application/PrivateReplyStore") {}
