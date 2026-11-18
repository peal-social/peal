import { socialAccounts } from "peal-ui/lib/site/links";
import type { Locale } from "peal-ui/lib/site/locales";
import { footerProps, headerProps } from "peal-ui/lib/site/navigation";
import type { PageLinks, SiteSettings } from "peal-ui/lib/site/navigation";
import { formatStars } from "peal-ui/lib/site/stars";

import type { BlogSettings } from "./config.ts";
import { messages } from "./i18n/messages.ts";
import { blogPath } from "./links.ts";

// The header's and the footer's props for a page of the blog: the site's,
// item for item, with its own pages on the site's origin and the blog's
// under this build's base.

/** A page's translations that a reader may open, by language. */
export type Translations = Partial<Record<Locale, string>>;

export interface ChromeInput {
  /** Astro's base, `import.meta.env.BASE_URL`. */
  readonly base: string;
  readonly locale: Locale;
  readonly settings: BlogSettings;
  readonly stars: number | undefined;
  /**
   * The page in each other language, by its path below the blog's root
   * there ("" for the index). A language without one leads to its index.
   */
  readonly translations: Translations;
}

/**
 * A page of the site, on its origin, in a language. The site lays out its
 * languages as the blog does, from the root.
 */
const sitePage = (settings: BlogSettings, locale: Locale, path = "") =>
  `${settings.site}${blogPath("/", locale, path)}`;

/** This page's address in a language: its translation, or the index. */
export const languageLink =
  (base: string, translations: Translations) =>
  (code: Locale): string =>
    blogPath(base, code, translations[code]);

export const chromeProps = ({
  base,
  locale,
  settings,
  stars,
  translations,
}: ChromeInput) => {
  const site: SiteSettings = {
    app: (page) => settings.app(locale, page),
    discord: settings.discord,
    docs: (page) => settings.docs(locale, page),
    stars: stars === undefined ? undefined : formatStars(stars, locale),
  };

  const pages: PageLinks = {
    blog: blogPath(base, locale),
    home: sitePage(settings, locale),
    language: languageLink(base, translations),
    legal: (document) => sitePage(settings, locale, document),
    locale,
    pricing: sitePage(settings, locale, "pricing"),
  };

  const t = messages(locale);

  return {
    footer: footerProps(t, pages, site, socialAccounts),
    header: headerProps(t, pages, site),
  };
};
