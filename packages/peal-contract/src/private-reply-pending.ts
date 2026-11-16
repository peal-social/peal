import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The comment has its private reply, on its way, unconfirmed or sent: its platform takes one a comment, so no other is written. */
export class PrivateReplyPending extends Schema.TaggedError<PrivateReplyPending>()(
  "PrivateReplyPending",
  {
    ...errorEnvelope,
    // The comment's private reply.
    privateReplyId: Schema.String,
  },
  {
    description:
      "The comment has its private reply, on its way, unconfirmed or sent: its platform takes one a comment, so no other is written. One that failed lets another through.",
    httpApiStatus: 409,
  }
) {}
