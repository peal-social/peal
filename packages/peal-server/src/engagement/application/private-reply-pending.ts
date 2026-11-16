import { Schema } from "effect";

import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";

/** The comment has its private reply, on its way, unconfirmed or sent: a platform takes one a comment, so no other is written. */
export class PrivateReplyPending extends Schema.TaggedError<PrivateReplyPending>()(
  "PrivateReplyPending",
  {
    commentId: CommentIdSchema,
    privateReplyId: PrivateReplyIdSchema,
  }
) {}
