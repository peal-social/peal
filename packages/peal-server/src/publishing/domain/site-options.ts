import { Schema } from "effect";

import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import {
  devtoTag,
  maxArticleTerms,
  maxTermLength,
  siteRules,
} from "#shared/domain/rich-text/site-rules.ts";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import { invalid, missing } from "./option-problem.ts";
import type { OptionProblem } from "./option-problem.ts";
import { PostTextSchema } from "./post-text.ts";
import { measureText } from "./text-length.ts";

// A website's post is an article: its title, an excerpt, a featured image
// of the library, its tags (and, on WordPress, its categories) by name,
// found on the site or made there, and what the site makes of it. Its
// body is the post's text on the channel, or the rich text of its
// override. The figures are each site's rules
// (`#shared/domain/rich-text/site-rules.ts`), which the articles check
// too.

/** The longest excerpt a website's post takes, in code points. */
export const maxArticleExcerptLength = 1000;

/**
 * What the site makes of the post once it shows it: a post `publish`ed,
 * or a `draft` someone finishes on the site. Peal sends it at the post's
 * time either way.
 */
export const SiteStatusOptionSchema = Schema.Literals(["publish", "draft"]);

export type SiteStatusOption = typeof SiteStatusOptionSchema.Type;

/** The image types a website's featured image may be, of those Peal stores. */
export const siteCoverTypes = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Hashnode takes images of 8 MB at most, read as mebibytes. */
export const hashnodeMaxImageBytes = 8 * 1024 * 1024;

const TermsSchema = Schema.Array(PostTextSchema).check(
  Schema.isMaxLength(maxArticleTerms)
);

/** The fields every website's options have. */
export const siteFields = {
  // A file of the library, the site's featured image.
  coverMediaId: Schema.optionalKey(MediaAssetIdSchema),
  // A summary, which the site shows in lists of posts.
  excerpt: Schema.optionalKey(PostTextSchema),
  // Left out, the site publishes it.
  siteStatus: Schema.optionalKey(SiteStatusOptionSchema),
  // Names, as the site shows them: found there, or made.
  tags: Schema.optionalKey(TermsSchema),
  title: Schema.optionalKey(PostTextSchema),
};

/** WordPress's categories, by name: found on the site, or made. */
export const categoriesField = Schema.optionalKey(TermsSchema);

/** What a website's options hold, whichever site. */
export interface SiteOptionsValues {
  readonly categories?: readonly string[];
  readonly coverMediaId?: string;
  readonly excerpt?: string;
  readonly siteStatus?: SiteStatusOption;
  readonly tags?: readonly string[];
  readonly title?: string;
}

/** A field of a website's options. */
export type SiteField =
  | "categories"
  | "coverMediaId"
  | "excerpt"
  | "siteStatus"
  | "tags"
  | "title";

const characters = (text: string) => measureText(text, "codePoints");

const tooLong = <Field extends SiteField>(
  field: Field,
  text: string | undefined,
  maximum: number
): readonly OptionProblem<Field>[] => {
  const length = text === undefined ? 0 : characters(text);

  return length > maximum ? [{ _tag: "tooLong", field, length, maximum }] : [];
};

const takesTerm = (name: string) =>
  name.trim() !== "" && name.length <= maxTermLength;

// Too many names, or one the site would not take, is refused.
const termProblems = <Field extends "categories" | "tags">(
  field: Field,
  names: readonly string[],
  maximum: number,
  takes: (name: string) => boolean
): readonly OptionProblem<Field>[] =>
  names.length > maximum || names.some((name) => !takes(name))
    ? [invalid(field)]
    : [];

/** A field every website's options have. */
export type ArticleField = Exclude<SiteField, "categories">;

/**
 * What the site would refuse in a website's options: a title it needs,
 * no longer than it takes; an excerpt within its bound; its tags within
 * the site's count, each a name it takes.
 */
export const articleProblems = (
  platform: SitePlatform,
  options: SiteOptionsValues
): readonly OptionProblem<ArticleField>[] => {
  const rules = siteRules[platform];
  const title = options.title ?? "";

  return [
    ...(title.trim() === "" ? [missing("title" as const)] : []),
    ...tooLong("title", options.title, rules.maxTitleLength),
    ...tooLong("excerpt", options.excerpt, maxArticleExcerptLength),
    ...termProblems("tags", options.tags ?? [], rules.maxTags, rules.takesTag),
  ];
};

/** What WordPress would refuse in a post's categories. */
export const categoriesProblems = (
  platform: SitePlatform,
  categories: readonly string[]
): readonly OptionProblem<"categories">[] =>
  termProblems(
    "categories",
    categories,
    siteRules[platform].maxCategories,
    takesTerm
  );

/** What a website's fields' schemas do not say, for clients. */
export const siteNotes = (
  platform: SitePlatform
): Readonly<Record<ArticleField, FieldNotes<LookupName>>> => {
  const rules = siteRules[platform];

  return {
    coverMediaId:
      platform === "hashnode"
        ? { contentTypes: siteCoverTypes, maxByteSize: hashnodeMaxImageBytes }
        : { contentTypes: siteCoverTypes },
    excerpt: { maxLength: maxArticleExcerptLength },
    siteStatus: { ifLeftOut: "publish" },
    tags:
      platform === "devto"
        ? { maximum: rules.maxTags, pattern: devtoTag.source }
        : { maximum: rules.maxTags },
    title: { maxLength: rules.maxTitleLength },
  };
};

/** WordPress's categories, for clients. */
export const categoriesNotes = (
  platform: SitePlatform
): FieldNotes<LookupName> => ({ maximum: siteRules[platform].maxCategories });
