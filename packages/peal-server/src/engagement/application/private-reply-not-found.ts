import { Schema } from "effect";

/** The workspace sent no such private reply, or it went with its comment. */
export class PrivateReplyNotFound extends Schema.TaggedError<PrivateReplyNotFound>()(
  "PrivateReplyNotFound",
  { privateReplyId: Schema.String }
) {}
