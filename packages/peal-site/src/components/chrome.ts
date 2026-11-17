import { getRelativeLocaleUrl } from "astro:i18n";

import { appLink, discordUrl, docsLink, socialAccounts } from "../config.ts";
import { formatStars, repositoryStars } from "../github.ts";
import type { Locale } from "../i18n/locales.ts";
import { messages } from "../i18n/messages.ts";
import { footerProps, headerProps } from "../navigation.ts";
import type { PageLinks, SiteSettings } from "../navigation.ts";

// The header's and the footer's props for a page, from the build's settings
// and Astro's routes. The layout renders both with peal-ui's components.

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
    // The blog is its own application, served at /blog in English.
    blog: "/blog",
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
