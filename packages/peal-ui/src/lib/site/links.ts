import { defaultLocale } from "./locales";
import type { Locale } from "./locales";

// Links and settings the pages of peal.social share, as plain functions of
// the values each app reads from its own environment.

/** A setting's value, or `undefined` when it is unset or blank. */
export const present = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
};

/** An origin as configured, without its trailing slashes. */
export const originOf = (value: string | undefined): string | undefined =>
  present(value)?.replace(/\/+$/u, "");

/**
 * A page of an app served in the reader's language at `origin` (the docs,
 * the web app), or `undefined` when no origin is configured. Those apps
 * serve English at the root and other locales under their prefix.
 */
export const siteLink = (
  origin: string | undefined,
  locale: Locale,
  path = ""
): string | undefined => {
  if (origin === undefined) {
    return undefined;
  }

  const prefix = locale === defaultLocale ? "" : `/${locale}`;

  return `${origin}${prefix}/${path}`;
};

export interface SocialAccount {
  readonly href: string;
  readonly name: string;
  /** Mastodon checks a `rel="me"` link back to the profile to verify it. */
  readonly rel?: "me";
}

/** Peal's own accounts, which the footer links to on every page. */
export const socialAccounts: readonly SocialAccount[] = [
  { href: "https://www.linkedin.com/company/peal-social", name: "LinkedIn" },
  { href: "https://x.com/peal_social", name: "X" },
  { href: "https://bsky.app/profile/peal.social", name: "Bluesky" },
  { href: "https://mastodon.social/@pealsocial", name: "Mastodon", rel: "me" },
  { href: "https://www.youtube.com/@pealsocial", name: "YouTube" },
];

/**
 * Whether search engines may index peal.social's pages. Not until Peal is
 * released: every page says noindex, nofollow, and the site's robots.txt
 * disallows all. At launch, set it to true and allow crawling there.
 */
export const indexable = false;

export interface PlausibleScript {
  readonly domain: string;
  readonly src: string;
}

/**
 * Plausible's script tag attributes for a domain, from a self-hosted
 * instance at `host` or from Plausible's own servers; `undefined` without a
 * domain.
 */
export const plausibleScript = (
  domain: string | undefined,
  host: string | undefined
): PlausibleScript | undefined => {
  const name = present(domain);

  return name === undefined
    ? undefined
    : {
        domain: name,
        src: `${originOf(host) ?? "https://plausible.io"}/js/script.js`,
      };
};
