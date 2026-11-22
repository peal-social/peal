import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The person has no chat with this id in this workspace: it never existed,
 * was deleted, or is someone else's.
 */
export class AgentChatNotFound extends Schema.TaggedError<AgentChatNotFound>()(
  "AgentChatNotFound",
  { ...errorEnvelope },
  {
    description:
      "You have no chat with this id in this workspace: it was deleted, expired, or belongs to someone else.",
    httpApiStatus: 404,
  }
) {}
