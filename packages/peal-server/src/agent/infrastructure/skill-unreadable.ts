import { Schema } from "effect";

/**
 * The agent's `read_skill` could not read the skill it named: the person
 * may use none with that id. Tagged as every tool's refusal is, so the
 * model reads it, and the step shows it, the same way.
 */
export class SkillUnreadable extends Schema.TaggedError<SkillUnreadable>()(
  "ToolRefused",
  { message: Schema.String }
) {}
