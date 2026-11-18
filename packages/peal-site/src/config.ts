import {
  SITE_APP_URL,
  SITE_DISCORD_URL,
  SITE_DOCS_URL,
  SITE_PLAUSIBLE_DOMAIN,
  SITE_PLAUSIBLE_HOST,
} from "astro:env/server";
import {
  originOf,
  plausibleScript,
  present,
  siteLink,
} from "peal-ui/lib/site/links";

import type { Locale } from "./i18n/locales.ts";

// Settings read from the environment at build time (declared in
// astro.config.ts). Each is optional: unset or empty turns its feature off.

export { indexable, socialAccounts } from "peal-ui/lib/site/links";

export type { PlausibleScript, SocialAccount } from "peal-ui/lib/site/links";

const docsOrigin = originOf(SITE_DOCS_URL);

/**
 * A page of the docs site in the reader's language, or `undefined` when no
 * docs URL is configured. The docs serve English at the root and other
 * locales under their prefix, as this site does.
 */
export const docsLink = (locale: Locale, path = ""): string | undefined =>
  siteLink(docsOrigin, locale, path);

const appOrigin = originOf(SITE_APP_URL);

/**
 * A page of the web app in the reader's language, or `undefined` when no
 * app URL is configured. The app serves English at the root and other
 * locales under their prefix, as this site does.
 */
export const appLink = (locale: Locale, path: string): string | undefined =>
  siteLink(appOrigin, locale, path);

/** The Discord server's invitation, or `undefined` when none is set. */
export const discordUrl = present(SITE_DISCORD_URL);

/**
 * Plausible's script tag attributes when SITE_PLAUSIBLE_DOMAIN is set; with
 * SITE_PLAUSIBLE_HOST it loads from a self-hosted instance.
 */
export const plausible = plausibleScript(
  SITE_PLAUSIBLE_DOMAIN,
  SITE_PLAUSIBLE_HOST
);
