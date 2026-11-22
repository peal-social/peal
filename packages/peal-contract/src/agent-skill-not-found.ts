import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The person may use no skill with this id in this workspace: it never
 * existed, was deleted, or is another person's own.
 */
export class AgentSkillNotFound extends Schema.TaggedError<AgentSkillNotFound>()(
  "AgentSkillNotFound",
  { ...errorEnvelope, skillId: Schema.String },
  {
    description:
      "You have no skill with this id in this workspace: it was deleted, or belongs to someone else.",
    httpApiStatus: 404,
  }
) {}
