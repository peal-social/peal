import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import { invalid } from "./option-problem.ts";
import type { OptionProblem } from "./option-problem.ts";
import { PostTextSchema } from "./post-text.ts";

// Snap's "Post Spotlight" (developers.snap.com, Public Profile API, Profile
// Asset Management, read 2026-11-26) requires `locale`: "Locale indicates
// the language and country. Example : en_US". A post has no language of its
// own in Peal, so the option says it, and the adapter sends
// `defaultSnapchatLocale` when it is left out.

/** What Peal sends as a Spotlight's `locale` when the option is left out. */
export const defaultSnapchatLocale = "en_US";

// Two lower-case letters, an underscore and two capitals, as Snap's example.
const localeCode = /^[a-z]{2}_[A-Z]{2}$/u;

// What Snap would refuse in them.
const snapchatProblems = (
  options: SnapchatOptions
): readonly OptionProblem<SnapchatField>[] =>
  options.locale === undefined || localeCode.test(options.locale)
    ? []
    : [invalid("locale")];

/**
 * How a post goes out on a Snapchat Public Profile, as a Spotlight. Nothing
 * is needed: left out, the Spotlight's `locale` is `en_US`.
 */
export class SnapchatOptions extends Schema.Class<SnapchatOptions>(
  "peal-server/publishing/domain/SnapchatOptions"
)({
  // The Spotlight's language and country, as Snap's `locale` takes them.
  locale: Schema.optionalKey(PostTextSchema),
  platform: Schema.tag("snapchat"),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<
    Record<SnapchatField, FieldNotes<LookupName>>
  > = { locale: { pattern: localeCode.source } };

  static readonly constraints: readonly OptionConstraint<SnapchatField>[] = [];

  /** What Snap would refuse in them. */
  problems(): readonly OptionProblem<SnapchatField>[] {
    return snapchatProblems(this);
  }
}

/** An option of Snapchat's. */
export type SnapchatField = Exclude<
  keyof typeof SnapchatOptions.fields,
  "platform"
>;
