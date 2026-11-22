import { Schema } from "effect";

/**
 * The person may use no skill with this id in this workspace: it never
 * existed, was deleted, or is another person's own.
 */
export class SkillNotFound extends Schema.TaggedError<SkillNotFound>()(
  "SkillNotFound",
  { skillId: Schema.String }
) {}
