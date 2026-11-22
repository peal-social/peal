import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why a skill cannot be saved as asked:
 *
 * - `nameTaken`: another skill the person may use has this name, whatever
 *   its case, so picking it by name would be ambiguous.
 * - `tooMany`: the person already sees `maxAgentSkills` skills here.
 * - `notEditable`: it is a workspace skill the person may use but not
 *   change, as they may not manage the workspace's (whoever wrote it), or
 *   one another member made that they may not take back to personal.
 */
export const AgentSkillRefusalSchema = Schema.Literals([
  "nameTaken",
  "tooMany",
  "notEditable",
]).annotate({ identifier: "AgentSkillRefusal" });

export type AgentSkillRefusal = typeof AgentSkillRefusalSchema.Type;

/** A skill that cannot be saved, changed or deleted as asked. */
export class AgentSkillRefused extends Schema.TaggedError<AgentSkillRefused>()(
  "AgentSkillRefused",
  { ...errorEnvelope, reason: AgentSkillRefusalSchema },
  {
    description:
      "The skill cannot be saved as asked: its name is taken, there are too many skills, or you may not change it.",
    httpApiStatus: 409,
  }
) {}
