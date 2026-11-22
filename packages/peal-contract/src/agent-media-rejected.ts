import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * A file attached to a message to the agent cannot be used: it is not one
 * of the workspace's media the person may read (`notFound`), or it is not
 * ready yet (`notReady`: still uploading, being checked, or refused).
 */
export class AgentMediaRejected extends Schema.TaggedError<AgentMediaRejected>()(
  "AgentMediaRejected",
  {
    ...errorEnvelope,
    // The attached file refused, as the message named it.
    mediaId: Schema.String,
    reason: Schema.Literals(["notFound", "notReady"]),
  },
  {
    description:
      "A file attached to the message cannot be used: it is not one of this workspace's media you may read (`notFound`), or it is not ready yet (`notReady`). Nothing was sent.",
    httpApiStatus: 422,
  }
) {}
