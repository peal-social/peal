import { Option, Schema } from "effect";
import type { Locale } from "next-intl";

import { routing } from "#i18n/routing.ts";
import { isAppPath } from "#shell/workspace-path.ts";

// A page's path: segments of letters, digits and the few marks a page's
// address holds, with no dot (the proxy takes a path with one for a file,
// and `.`, `..` and `.well-known` are not pages) and no `%`, which a
// browser or a proxy may decode into a dot segment, a slash or another
// first segment (`/%61pi`). No empty segment, so no `//`.
const pagePath = /^\/(?:[\w~!$&'()*+,;=:@-]+(?:\/[\w~!$&'()*+,;=:@-]+)*)?$/u;

// What may follow, a query and a fragment: printable ASCII, as a browser
// sends them encoded, never a backslash nor `//`.
const pageQuery = /^(?:[?#][!-[\]-~]*)?$/u;

// First segments that are not pages: the server's (`/api`, the discovery
// documents) and the web app's route handlers, in any case, as a short link
// under /api/l answers a redirect to anywhere.
const notPages: ReadonlySet<string> = new Set([
  ".well-known",
  "_next",
  "api",
  "emoji-data",
  "pulse",
  "studio-assets",
]);

const locales: ReadonlySet<string> = new Set(routing.locales);

const isPagePath = (next: string): boolean => {
  const at = next.search(/[?#]/u);
  const path = at === -1 ? next : next.slice(0, at);
  const rest = at === -1 ? "" : next.slice(at);

  if (!pagePath.test(path) || !pageQuery.test(rest) || rest.includes("//")) {
    return false;
  }

  const segments = path
    .slice(1)
    .split("/")
    .map((segment) => segment.toLowerCase());

  // Every leading language, as next-intl drops a default one's prefix a
  // redirect at a time (`/en/en/api` becomes `/en/api`, then `/api`). A
  // page names one language at most, so a second is refused outright.
  const languages = segments.findIndex((segment) => !locales.has(segment));
  const named = languages === -1 ? segments.length : languages;

  return named <= 1 && !notPages.has(segments[named] ?? "");
};

// A page of this app, never another site's (a second slash or a backslash
// that browsers read as another host) nor a path the server answers.
const NextPathSchema = Schema.String.check(
  Schema.makeFilter(isPagePath, { expected: "a page of this app" })
);

const decodeNextPath = Schema.decodeUnknownOption(NextPathSchema);

/**
 * Where to go after signing in, from a page's `next` query parameter: a
 * path on this site, never another one, so a link cannot send people away.
 */
export const nextPathOf = (
  value: string | readonly string[] | undefined
): Option.Option<string> => decodeNextPath(value);

const decodeLocale = Schema.decodeUnknownOption(
  Schema.Literals(routing.locales)
);

// The language a path opens in of its own: /fr, /fr/posts, /fr?x, in any
// case, as next-intl reads it.
const localePrefix = new RegExp(
  `^/(${routing.locales.join("|")})(?=[/?#]|$)`,
  "iu"
);

/** The language a page's address names (`/fr/…`), if any. */
export const languageOf = (address: string): Option.Option<Locale> =>
  decodeLocale(localePrefix.exec(address)?.[1]?.toLowerCase());

/**
 * A page's address without the language it names: `/fr/posts?x` is
 * `/posts?x`, `/fr?x` is `/?x`, `/fr` is `/`.
 */
export const withoutLanguage = (address: string): string => {
  const rest = address.replace(localePrefix, "");

  return rest.startsWith("/") ? rest : `/${rest}`;
};

/**
 * A page's address in a language, which it names, English too (`/en/…`),
 * whatever it named before: `/fr/posts?x` in English is `/en/posts?x`,
 * `/?x` in French `/fr?x`, `/` `/fr`.
 */
export const inLanguage = (locale: Locale, address: string): string => {
  const rest = withoutLanguage(address);

  return `/${locale}${rest === "/" || rest.startsWith("/?") ? rest.slice(1) : rest}`;
};

/** Where sign-in goes: a path without a language, and the one to open it in. */
export interface Landing {
  readonly href: string;
  readonly locale: Option.Option<Locale>;
}

/**
 * Where to go once signed in, from `next`: the path without the language
 * it names, which next-intl's router prefixes itself, in the language to
 * open it in. A page of the signed-in app opens in the one the account
 * keeps, whatever the path names, as the app is in it everywhere
 * (#i18n/account-language.ts); another page in the language its path
 * names, else in the account's. None: the router's own, the page's.
 */
export const landingOf = (
  next: string,
  accountLocale: string | null | undefined
): Landing => {
  const href = withoutLanguage(next);
  const named = languageOf(next);
  const account = decodeLocale(accountLocale);

  return {
    href,
    locale: isAppPath(href)
      ? Option.orElse(account, () => named)
      : Option.orElse(named, () => account),
  };
};

/**
 * Where a sign-in lands: the password's, which loads it anew, and a
 * provider's, as the server sends it on from the sign-in page it comes
 * back to (`signInReturn`). The address `landingOf` gives, its language
 * named, else the sign-in page's, so both ways to sign in open the same
 * page in the same language. English is named
 * (`/en/…`), so next-intl sets the language cookie to it as it drops the
 * prefix, and the address without one does not open in the cookie's.
 */
export const landingAddressOf = (
  next: string,
  accountLocale: string | null | undefined,
  pageLocale: Locale
): string => {
  const { href, locale } = landingOf(next, accountLocale);

  return inLanguage(
    Option.getOrElse(locale, () => pageLocale),
    href
  );
};
