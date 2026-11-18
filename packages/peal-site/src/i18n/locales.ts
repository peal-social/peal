import { defaultLocale, locales } from "peal-ui/lib/site/locales";

// The site's languages, which it shares with the blog (peal-ui's
// lib/site/locales.ts). A new language also needs its catalogue in
// ./messages.ts and its legal documents in src/content/legal/<code>/.
export { defaultLocale, locales, pageLocale } from "peal-ui/lib/site/locales";

export type { Locale } from "peal-ui/lib/site/locales";

/**
 * `getStaticPaths` entries for a page under `src/pages/[...locale]/`: the
 * default locale renders at the root, the others under their prefix.
 */
export const localePaths = () =>
  locales.map((locale) => ({
    params: { locale: locale === defaultLocale ? undefined : locale },
  }));
