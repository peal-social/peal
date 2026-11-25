import { Option } from "effect";
import type { Locale } from "next-intl";
import type { Me } from "peal-contract";

import { languageOf, nextPathOf, withoutLanguage } from "#auth/next-path.ts";
import { routing } from "#i18n/routing.ts";

/**
 * The request header the proxy gives every page: its path and query, as
 * the browser asked for them, for the signed-in app's layout, which has
 * no other way to read its address. The proxy writes it over whatever
 * the browser sent under that name.
 */
export const pageAddressHeader = "x-peal-page";

/**
 * next-intl's cookie for the language a browser last opened a page in,
 * which it reads for an address without one: its default name, which
 * `routing` keeps.
 */
export const localeCookieName = "NEXT_LOCALE";

/**
 * The language a signed-in person's pages are shown in: the one their
 * account keeps, chosen on the Preferences page. None while staff act as
 * them: staff read the app in the language of the address, then of their
 * own browser, as anyone does, so a support case is never read in a
 * language its reader did not pick, and their own browser keeps its own.
 */
export const accountLanguageOf = (me: Me): Option.Option<Locale> =>
  me.impersonatedBy === null ? Option.some(me.user.locale) : Option.none();

// What follows a language's prefix: `/fr/posts?x` → `/posts?x`, `/fr?x`
// → `?x`, `/` → "".
const afterLanguage = (address: string): string => {
  const rest = withoutLanguage(address);

  return rest.startsWith("/?") || rest === "/" ? rest.slice(1) : rest;
};

/**
 * What a layout of the signed-in app knows of the page it renders, from
 * its route's own params: the language it is shown in, and the first
 * segments of a path, its language left out, that it serves ("" for `/`).
 */
export interface ShownPage {
  readonly firstSegments: readonly string[];
  readonly locale: Locale;
}

// Whether an address is the page shown, as the proxy hands it on: its
// language (English when it names none, as next-intl rewrites an address
// without one to English only) and its first segment are the route's.
// Where the proxy did not run (a path it skips, or next-intl's early
// return), the browser's own header reaches the page, which names any.
const names = (page: string, shown: ShownPage): boolean => {
  const [path = ""] = withoutLanguage(page).split("?");
  const [, first = ""] = path.split("/");

  return (
    Option.getOrElse(languageOf(page), () => routing.defaultLocale) ===
      shown.locale && shown.firstSegments.includes(first)
  );
};

/**
 * Where a page of the signed-in app goes when it is shown in another
 * language than the account's (`accountLanguageOf`): the same path and
 * query in the account's language. English is named too (`/en/…`), so the
 * proxy moves the language cookie to it before next-intl drops the
 * prefix; without it, the cookie would open the next address without a
 * language in the other. The fragment, which the server never sees, stays
 * with the browser. None for someone signed out, for staff acting as
 * someone, for a page already in the right language, and for an address
 * that is not a page of this app or not the page shown (`names`).
 */
export const accountLanguageAddress = (
  me: Option.Option<Me>,
  shown: ShownPage,
  address: string | null
): Option.Option<string> =>
  me.pipe(
    Option.flatMap(accountLanguageOf),
    Option.filter((account) => account !== shown.locale),
    Option.flatMap((account) =>
      nextPathOf(address ?? undefined).pipe(
        Option.filter((page) => names(page, shown)),
        Option.map((page) => `/${account}${afterLanguage(page)}`)
      )
    )
  );
