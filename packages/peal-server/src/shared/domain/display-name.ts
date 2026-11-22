import { Result } from "effect";

import { storableLine } from "./platform-text.ts";

// A person's name and a workspace's are shown to other people, in Peal's
// pages and in the emails Peal sends from its own domain (an invitation's
// subject and body name both). A name is one line, bounded, and holds no
// web address's markers (`://`, `www.`); a name that still reads as a
// host or an address (`Booking.com`, `admin@example.test`) is a fine name
// in the app, and is left out of emails (`nameForMail`), where a mail
// client would make a link of it.

/** The most characters of a person's name. */
export const maxPersonNameLength = 100;

/**
 * The most characters of a workspace's name, as the partner API takes it
 * (the contract's `maxWorkspaceNameLength`).
 */
export const maxWorkspaceNameLength = 120;

// Dots a mail client may read as one between a host's labels: the full
// stop, and the ideographic and full-width ones IDNA maps to it.
const dot = String.raw`[.。．｡]`;

const scheme = "://";

const worldWideWeb = new RegExp(String.raw`(?:^|[^\p{L}\p{N}])www${dot}`, "iu");

// A letter, a digit or a mark, a dot, then a letter and another letter or
// mark, in any script and any case: what a host's last labels look like
// (`evil.social`, `Fly.io`, `пример.рф`, `हिन्दी.भारत`, whose letters carry
// combining marks).
const hostLike = new RegExp(
  String.raw`[\p{L}\p{N}\p{M}]${dot}\p{L}[\p{L}\p{M}]`,
  "u"
);

// What a mail client dials: a `tel:` or `sms:` link, or seven digits or
// more, with spaces, dots, dashes or parentheses between them.
const phoneLink = /(?:^|[^\p{L}\p{N}])(?:tel|sms):/iu;

const phoneNumber = /\d(?:[\s.()-]*\d){6}/u;

// Four numbers joined by dots: an IPv4 address.
const dottedAddress = new RegExp(
  String.raw`(?:^|[^\p{N}])\d{1,3}(?:${dot}\d{1,3}){3}(?![\p{N}])`,
  "u"
);

/** Whether a name holds a web address's markers: `://` or `www.`. */
export const holdsLinkMarker = (name: string): boolean =>
  name.includes(scheme) || worldWideWeb.test(name);

/**
 * Whether a name reads as a host, an address or a number to call to a mail
 * client, by a broad test on its composed form (NFC, so a decomposed
 * letter reads as the letter): a link's markers, `@`, a letter, a digit or
 * a mark followed by a dot and two letters (any script, any case, marks
 * included), a dotted IPv4 address, `tel:` or `sms:`, or seven digits or
 * more. `St. John` and `J.R.R. Tolkien` do not; `Booking.com`, `Node.js`,
 * `M.Sc` and `Call +1 900 555 0199` do.
 */
export const readsAsAddress = (given: string): boolean => {
  const name = given.normalize("NFC");

  return (
    holdsLinkMarker(name) ||
    name.includes("@") ||
    hostLike.test(name) ||
    dottedAddress.test(name) ||
    phoneLink.test(name) ||
    phoneNumber.test(name)
  );
};

/**
 * A name as an email shows it: as written, unless it reads as a host or
 * an address (`readsAsAddress`), where `fallback` (a member, a workspace,
 * in the reader's language) takes its place, so no email of Peal's carries
 * a link someone typed for others to follow.
 */
export const nameForMail = (name: string, fallback: string): string =>
  readsAsAddress(name) ? fallback : name;

/** Why a name typed for others to read is refused. */
export type NameRefusal = "empty" | "link" | "tooLong";

/**
 * A name a person typed, as it is kept (`storableLine`: one line, no
 * control characters nor marks that reorder it), or why it is refused:
 * nothing left, more than `maximum` characters, or a web address's
 * markers (`holdsLinkMarker`).
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

  return holdsLinkMarker(kept) ? Result.fail("link") : Result.succeed(kept);
};

/**
 * A name that came from elsewhere (a sign-in provider's profile), made
 * fit rather than refused, so the sign-in goes on: one line of `maximum`
 * characters at most, without a web address's markers (`https://x`
 * becomes `https x`, `www.` becomes `www `). May be empty. Emails still
 * leave out one that reads as an address (`nameForMail`).
 */
export const fittedName = (given: string, maximum: number): string => {
  const kept = storableLine(given, maximum);

  return holdsLinkMarker(kept)
    ? storableLine(
        kept
          .replaceAll(scheme, " ")
          .replaceAll(new RegExp(String.raw`(www)${dot}`, "giu"), "$1 "),
        maximum
      )
    : kept;
};
