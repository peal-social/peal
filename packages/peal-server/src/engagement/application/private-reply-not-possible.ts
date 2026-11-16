import { Schema } from "effect";

import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { PrivateReplyRefusalSchema } from "#engagement/domain/private-reply.ts";

/**
 * The comment cannot get a private reply: it is the account's own
 * (`ownComment`), the platform no longer shows it (`gone`), or it was
 * written longer ago than Meta's seven days allow, less Peal's hour
 * (`tooOld`).
 */
export class PrivateReplyNotPossible extends Schema.TaggedError<PrivateReplyNotPossible>()(
  "PrivateReplyNotPossible",
  {
    commentId: CommentIdSchema,
    reason: PrivateReplyRefusalSchema,
  }
) {}
