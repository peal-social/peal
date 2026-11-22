import { Schema } from "effect";

/**
 * A skill cannot be saved as asked: another skill the person may use has
 * its name, whatever its case (`nameTaken`); they already see
 * `maxSkills` (`tooMany`); or they may not change it, or not move it
 * where asked (`notEditable`).
 */
export class SkillRefused extends Schema.TaggedError<SkillRefused>()(
  "SkillRefused",
  { reason: Schema.Literals(["nameTaken", "tooMany", "notEditable"]) }
) {}
