import type { SitePlatform } from "#shared/domain/platform.ts";

/**
 * What a kind of website takes of an article, checked when it is
 * scheduled (`articleViolations`): the longest title, how many tags and
 * categories, and what a tag's name may hold.
 */
export interface SiteRules {
  readonly maxCategories: number;
  readonly maxTags: number;
  readonly maxTitleLength: number;
  /** Whether the site takes a tag of this name, as it is written. */
  readonly takesTag: (name: string) => boolean;
}

/** The longest name of a tag or a category (WordPress keeps 200). */
export const maxTermLength = 200;

/** The most tags, and the most categories, a WordPress article names. */
export const maxArticleTerms = 20;

/** The longest title a WordPress article takes. */
export const maxArticleTitleLength = 500;

// DEV (Forem): four tags at most, each letters and digits only, 30
// characters at most (`Article::MAX_TAG_LIST_SIZE`, `Tag` validations);
// a title of 128 characters at most; no categories.
const devtoTag = /^[\p{L}\p{N}]{1,30}$/u;

/** Each kind of website's rules. */
export const siteRules: Readonly<Record<SitePlatform, SiteRules>> = {
  devto: {
    maxCategories: 0,
    maxTags: 4,
    maxTitleLength: 128,
    takesTag: (name) => devtoTag.test(name.trim()),
  },
  wordpress: {
    maxCategories: maxArticleTerms,
    maxTags: maxArticleTerms,
    maxTitleLength: maxArticleTitleLength,
    takesTag: (name) => name.trim() !== "" && name.length <= maxTermLength,
  },
};
