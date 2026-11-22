import { Result } from "effect";

import { storableLine } from "./platform-text.ts";

// A person's name and a workspace's are shown to other people, in Peal's
// pages and in the emails Peal sends from its own domain (an invitation's
// subject and body name both): such a name is one line, bounded, and
// never reads as a link, so no email of Peal's carries an address someone
// typed for others to follow.

/** The most characters of a person's name. */
export const maxPersonNameLength = 100;

/**
 * The most characters of a workspace's name, as the partner API takes it
 * (the contract's `maxWorkspaceNameLength`).
 */
export const maxWorkspaceNameLength = 120;

// Dots a mail client may read as one between a host's labels: the full
// stop, and the ideographic and full-width ones IDNA maps to it.
const dots = /[.。．｡]/gu;

// Top-level domains of more than two letters that links use most: a dot
// right before one, after a letter or a digit, reads as a host. Two
// letters (a country's) count when written in one case (`evil.ru`,
// `EVIL.RU`), not as a name's initials or a title are (`M.Sc`, `Dr.Jo`).
const longTopLevel =
  "app|art|biz|blog|buzz|cam|cfd|click|cloud|club|com|dev|email|fun|help|icu|info|lat|life|link|live|lol|mobi|mov|name|net|news|one|online|org|page|pro|pw|rest|sbs|shop|site|space|store|support|tech|today|top|vip|website|win|work|world|xyz|zip";

// A letter or a digit, a dot, then a top-level domain that ends there.
const longHost = new RegExp(
  String.raw`[\p{L}\p{N}][.\u3002\uFF0E\uFF61](?:${longTopLevel}|xn--[a-z0-9-]+)(?![\p{L}\p{N}])`,
  "iu"
);

const countryHost =
  /[\p{L}\p{N}][.。．｡](?:[a-z]{2}|[A-Z]{2})(?![\p{L}\p{N}])/u;

const scheme = "://";

const worldWideWeb = /(?:^|[^\p{L}\p{N}])www[.。．｡]/iu;

/**
 * Whether a name reads as a link, or holds one: a scheme (`://`), `www.`,
 * or a host (a letter or a digit, a dot, then a top-level domain that
 * ends there). Conservative: a dot followed by a space (`St. John`), by
 * one letter (`J.R.R.`), or by a word that is no domain is a name's.
 */
export const readsAsLink = (name: string): boolean =>
  name.includes(scheme) ||
  worldWideWeb.test(name) ||
  longHost.test(name) ||
  countryHost.test(name);

/** Why a name typed for others to read is refused. */
export type NameRefusal = "empty" | "link" | "tooLong";

/**
 * A name a person typed, as it is kept (`storableLine`: one line, no
 * control characters nor marks that reorder it), or why it is refused:
 * nothing left, more than `maximum` characters, or what reads as a link.
 */
export const typedName = (
  typed: string,
  maximum: number
): Result.Result<string, NameRefusal> => {
  const kept = storableLine(typed, Number.POSITIVE_INFINITY);

  if (kept === "") {
    return Result.fail("empty");
  }

  // Bounded as `storableLine` bounds a name, by code points: what it cuts
  // was longer.
  if (storableLine(kept, maximum) !== kept) {
    return Result.fail("tooLong");
  }

  return readsAsLink(kept) ? Result.fail("link") : Result.succeed(kept);
};

/**
 * A name that came from elsewhere (a sign-in provider's profile), made
 * fit rather than refused, so the sign-in goes on: one line of `maximum`
 * characters at most, its schemes and dots taken out where it reads as a
 * link (`evil.com/x` becomes `evil com/x`). May be empty.
 */
export const fittedName = (given: string, maximum: number): string => {
  const kept = storableLine(given, maximum);

  return readsAsLink(kept)
    ? storableLine(kept.replaceAll(scheme, " ").replaceAll(dots, " "), maximum)
    : kept;
};
