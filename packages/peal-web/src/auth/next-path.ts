import { Option, Schema } from "effect";
import type { Locale } from "next-intl";

import { routing } from "#i18n/routing.ts";

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

// A path that opens in a language of its own: /fr, /fr/posts, /fr?x.
const localePrefix = new RegExp(
  `^/(?:${routing.locales.join("|")})(?:[/?#]|$)`,
  "u"
);

/**
 * The language to open `next` in once signed in: the one the account keeps,
 * so the app speaks it whichever page the person signed in from, unless the
 * path names a language itself.
 */
export const landingLocale = (
  next: string,
  accountLocale: string | null | undefined
): Option.Option<Locale> =>
  localePrefix.test(next) ? Option.none() : decodeLocale(accountLocale);

/**
 * The address a sign-in loads anew once done: `next` in the language the
 * account keeps, else the page's (`localized` adds its prefix, as
 * `getPathname` does), or as it is when it names its own language.
 */
export const landingAddress = (
  next: string,
  accountLocale: string | null | undefined,
  pageLocale: Locale,
  localized: (href: string, locale: Locale) => string
): string =>
  localePrefix.test(next)
    ? next
    : localized(
        next,
        Option.getOrElse(landingLocale(next, accountLocale), () => pageLocale)
      );
