import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import type { OptionProblem } from "./option-problem.ts";
import { articleProblems, siteFields, siteNotes } from "./site-options.ts";

// Hashnode's GraphQL `publishPost` (`createDraft` for a draft): `title`,
// `subtitle` (the excerpt), `coverImageOptions` (an image Peal uploads
// first, 8 MB at most), `tags` by slug, 15 at most. No categories. The
// post's body is its text on the channel, or the rich text of its
// override, as Markdown. Its API needs Hashnode's Pro plan on the
// publication.

/**
 * How a post goes out on a Hashnode publication. A draft may lack any of
 * them; scheduling needs `title`. Left out, Hashnode publishes the post
 * (`siteStatus`).
 */
export class HashnodeOptions extends Schema.Class<HashnodeOptions>(
  "peal-server/publishing/domain/HashnodeOptions"
)({
  ...siteFields,
  platform: Schema.tag("hashnode"),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<
    Record<HashnodeField, FieldNotes<LookupName>>
  > = siteNotes("hashnode");

  /** No rule ties two of Hashnode's options together. */
  static readonly constraints: readonly OptionConstraint<HashnodeField>[] = [];

  /** What Hashnode would refuse in them. */
  problems(): readonly OptionProblem<HashnodeField>[] {
    return articleProblems("hashnode", this);
  }
}

/** An option of Hashnode's. */
export type HashnodeField = Exclude<
  keyof typeof HashnodeOptions.fields,
  "platform"
>;
