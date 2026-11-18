import { getRelativeLocaleUrl } from "astro:i18n";
import { footerProps, headerProps } from "peal-ui/lib/site/navigation";
import type { PageLinks, SiteSettings } from "peal-ui/lib/site/navigation";
import { formatStars } from "peal-ui/lib/site/stars";

import { appLink, discordUrl, docsLink, socialAccounts } from "../config.ts";
import { repositoryStars } from "../github.ts";
import { defaultLocale } from "../i18n/locales.ts";
import type { Locale } from "../i18n/locales.ts";
import { messages } from "../i18n/messages.ts";

// The header's and the footer's props for a page, from the build's settings
// and Astro's routes. The layout renders both with peal-ui's components.

/**
 * The blog, its own application on the same host name, in the page's
 * language: /blog in English, /blog/<locale>/ in the others.
 */
const blogLink = (locale: Locale): string =>
  locale === defaultLocale ? "/blog" : `/blog/${locale}/`;

export const chrome = async (
  locale: Locale,
  path: string,
  current?: PageLinks["current"]
) => {
  const stars = await repositoryStars();

  const settings: SiteSettings = {
    app: (page) => appLink(locale, page),
    discord: discordUrl,
    docs: (page) => docsLink(locale, page),
    stars: stars === undefined ? undefined : formatStars(stars, locale),
  };

  const pages: PageLinks = {
    blog: blogLink(locale),
    current,
    home: getRelativeLocaleUrl(locale),
    language: (code) => getRelativeLocaleUrl(code, path),
    legal: (document) => getRelativeLocaleUrl(locale, document),
    locale,
    pricing: getRelativeLocaleUrl(locale, "pricing"),
  };

  const t = messages(locale);

  return {
    footer: footerProps(t, pages, settings, socialAccounts),
    header: headerProps(t, pages, settings),
  };
};
