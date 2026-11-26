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

// WordPress's `POST /wp/v2/posts`: `title`, `excerpt`, `featured_media`
// (a file Peal uploads to the site's library first), `tags` and
// `categories` by id (each found by name on the site, or made), and
// `status` (developer.wordpress.org/rest-api/reference/posts, read
// 2026-11-26). The post's body is its text on the channel, or the rich
// text of its override, as HTML.

/**
 * How a post goes out on a WordPress site of its own. A draft may lack
 * any of them; scheduling needs `title`. Left out, the site publishes the
 * post (`siteStatus`).
 */
export class WordPressOptions extends Schema.Class<WordPressOptions>(
  "peal-server/publishing/domain/WordPressOptions"
)({
  ...siteFields,
  categories: categoriesField,
  platform: Schema.tag("wordpress"),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<
    Record<WordPressField, FieldNotes<LookupName>>
  > = {
    ...siteNotes("wordpress"),
    categories: categoriesNotes("wordpress"),
  };

  /** No rule ties two of WordPress's options together. */
  static readonly constraints: readonly OptionConstraint<WordPressField>[] = [];

  /** What the site would refuse in them. */
  problems(): readonly OptionProblem<WordPressField>[] {
    return [
      ...articleProblems("wordpress", this),
      ...categoriesProblems("wordpress", this.categories ?? []),
    ];
  }
}

/** An option of a WordPress site's. */
export type WordPressField = Exclude<
  keyof typeof WordPressOptions.fields,
  "platform"
>;
