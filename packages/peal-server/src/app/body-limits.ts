import { ByteSize, Option } from "effect";

/**
 * The most a request's body may hold, unless its route takes more
 * (`contentBodyLimit`) or less (the error reports, Stripe's meter errors,
 * Meta's events and the review page set their own, smaller, where they
 * read it). Media never comes through the server: browsers and clients
 * send files to the bucket, and imports fetch them.
 */
export const defaultBodyLimit = ByteSize.mebibytes(1);

/**
 * What the routes that take a workspace's content may receive: posts, 50
 * at once in a bulk request or a CSV import of a million characters, an
 * article's rich-text document, and the MCP endpoint, whose create_posts
 * takes 50 posts too.
 */
export const contentBodyLimit = ByteSize.mebibytes(8);

/**
 * The largest of those limits, which Bun applies to every request as it
 * reads the socket: past it, it stops reading and answers 413 itself.
 */
export const largestBodyLimit = contentBodyLimit;

const contentPaths: readonly RegExp[] = [
  /^\/api\/workspaces\/[^/]+\/(?:posts|articles)(?:\/|$)/u,
  /^\/api\/mcp$/u,
];

const pathOf = (url: string) => url.split(/[?#]/u, 1)[0] ?? url;

/** The most the body of a request to this address may hold. */
export const bodyLimitFor = (url: string): ByteSize.ByteSize => {
  const path = pathOf(url);

  return contentPaths.some((pattern) => pattern.test(path))
    ? contentBodyLimit
    : defaultBodyLimit;
};

/**
 * Whether a request's declared length is past its limit: a body it says is
 * larger is refused before a byte of it is read. A request that declares
 * none is held to the limit as its body is read.
 */
export const declaredPastLimit = (
  declared: string | undefined,
  limit: ByteSize.ByteSize
): boolean =>
  Option.fromUndefinedOr(declared).pipe(
    Option.map(Number),
    Option.filter(Number.isSafeInteger),
    Option.exists((length) => BigInt(length) > ByteSize.toBigInt(limit))
  );
