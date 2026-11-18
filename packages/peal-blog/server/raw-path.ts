// The spellings of a path the blog refuses as sent, before Node and Astro
// read it. A URL parser resolves dot segments ("..", "%2e%2e") and reads a
// backslash as a slash, so /blog/%2e%2e/_emdash/api reaches EmDash's API as
// /_emdash/api, past src/guard.ts, which only sees the resolved path. No
// page or EmDash route needs any of these spellings.

const dotSegment = /(?:^|\/)\.{1,2}(?:\/|$)/u;

const refusedSpellings = [
  // A dot or a percent, encoded: an encoded dot segment, or one encoded
  // twice.
  /%2e/iu,
  /%25/u,
  // A backslash, as is or encoded, which a URL parser reads as a slash.
  /\\/u,
  /%5c/iu,
];

/** Whether the blog refuses a request target (`req.url`) as sent. */
export const rawPathRefused = (target: string): boolean => {
  const [path = ""] = target.split("?", 1);

  return (
    dotSegment.test(path) ||
    refusedSpellings.some((spelling) => spelling.test(path))
  );
};
