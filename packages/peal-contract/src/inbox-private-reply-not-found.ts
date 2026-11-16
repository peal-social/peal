import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/** The workspace sent no such private reply, or it went with its comment. */
export class InboxPrivateReplyNotFound extends Schema.TaggedError<InboxPrivateReplyNotFound>()(
  "InboxPrivateReplyNotFound",
  { ...errorEnvelope },
  {
    description:
      "The workspace sent no such private reply, or it went with its comment.",
    httpApiStatus: 404,
  }
) {}
