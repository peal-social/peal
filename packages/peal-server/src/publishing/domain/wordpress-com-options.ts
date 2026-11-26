import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import type { OptionProblem } from "./option-problem.ts";
import {
  articleProblems,
  categoriesField,
  categoriesNotes,
  categoriesProblems,
  siteFields,
  siteNotes,
} from "./site-options.ts";

// WordPress.com runs WordPress: its sites take WordPress's `POST
// /wp/v2/posts` under `/wp/v2/sites/{id}/`, the same fields and rules as a
// WordPress site of its own (`./wordpress-options.ts`).

/**
 * How a post goes out on a site on WordPress.com. A draft may lack
 * any of them; scheduling needs `title`. Left out, the site publishes the
 * post (`siteStatus`).
 */
export class WordPressComOptions extends Schema.Class<WordPressComOptions>(
  "peal-server/publishing/domain/WordPressComOptions"
)({
  ...siteFields,
  categories: categoriesField,
  platform: Schema.tag("wordpressCom"),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<
    Record<WordPressComField, FieldNotes<LookupName>>
  > = {
    ...siteNotes("wordpressCom"),
    categories: categoriesNotes("wordpressCom"),
  };

  /** No rule ties two of WordPress.com's options together. */
  static readonly constraints: readonly OptionConstraint<WordPressComField>[] =
    [];

  /** What the site would refuse in them. */
  problems(): readonly OptionProblem<WordPressComField>[] {
    return [
      ...articleProblems("wordpressCom", this),
      ...categoriesProblems("wordpressCom", this.categories ?? []),
    ];
  }
}

/** An option of a WordPress.com site's. */
export type WordPressComField = Exclude<
  keyof typeof WordPressComOptions.fields,
  "platform"
>;
