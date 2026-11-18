import { defaultLocale } from "peal-ui/lib/site/locales";
import type { Locale } from "peal-ui/lib/site/locales";

// Every link to a page of the blog goes through here, so the pages follow
// Astro's base: /blog in production, / in development.

/**
 * A page of the blog under `base`, in a language: English at the base's
 * root, other locales under their prefix. `path` is below that, without a
 * leading slash: "" for the index, a post's slug for a post.
 */
export const blogPath = (base: string, locale: Locale, path = ""): string => {
  const root = base.replace(/\/+$/u, "");
  const prefix = locale === defaultLocale ? "" : `/${locale}`;

  return `${root}${prefix}/${path}`;
};

/** A page of this build's blog, under Astro's base. */
export const blogLink = (locale: Locale, path = ""): string =>
  blogPath(import.meta.env.BASE_URL, locale, path);
