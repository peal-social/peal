import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import type { OptionProblem } from "./option-problem.ts";
import { articleProblems, siteFields, siteNotes } from "./site-options.ts";

// DEV's (Forem's API v1) `POST /api/articles`: `title`, `description`
// (the excerpt), `main_image` (a file Peal uploads to `/api/images`
// first), `tags`, four at most, each letters and digits, and `published`
// (false for a draft). No categories. The post's body is its text on the
// channel, or the rich text of its override, as Markdown.

/**
 * How a post goes out on DEV. A draft may lack any of them; scheduling
 * needs `title`. Left out, DEV publishes the post (`siteStatus`).
 */
export class DevtoOptions extends Schema.Class<DevtoOptions>(
  "peal-server/publishing/domain/DevtoOptions"
)({
  ...siteFields,
  platform: Schema.tag("devto"),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<Record<DevtoField, FieldNotes<LookupName>>> =
    siteNotes("devto");

  /** No rule ties two of DEV's options together. */
  static readonly constraints: readonly OptionConstraint<DevtoField>[] = [];

  /** What DEV would refuse in them. */
  problems(): readonly OptionProblem<DevtoField>[] {
    return articleProblems("devto", this);
  }
}

/** An option of DEV's. */
export type DevtoField = Exclude<keyof typeof DevtoOptions.fields, "platform">;
