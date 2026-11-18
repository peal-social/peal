// The languages of peal.social's pages, the site's and the blog's. English
// is the default and has no URL prefix; every other locale lives under
// /<code>/. Both apps' Astro configs read this list, so a new language is
// added here, with its strings in ./messages.ts and in each app's own
// catalogue.
export const locales = ["en", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * The locale Astro resolved for the current page (`Astro.currentLocale`),
 * narrowed to one these pages define.
 */
export const pageLocale = (current: string | undefined): Locale =>
  locales.find((locale) => locale === current) ?? defaultLocale;
