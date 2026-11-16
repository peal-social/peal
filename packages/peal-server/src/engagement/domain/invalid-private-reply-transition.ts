import { Schema } from "effect";

import { PrivateReplyIdSchema } from "./private-reply-id.ts";

/** A private reply was asked to move on from a state that does not allow it. */
export class InvalidPrivateReplyTransition extends Schema.TaggedError<InvalidPrivateReplyTransition>()(
  "InvalidPrivateReplyTransition",
  {
    from: Schema.Literals(["sending", "sent", "failed", "unconfirmed"]),
    privateReplyId: PrivateReplyIdSchema,
  }
) {}
