import { apiChangelog } from "./api-changelog.ts";

/**
 * The header that names a version of the API: the server sends it on every
 * answer, and a client sends the one it was written against.
 */
export const apiVersionHeader = "peal-version";

/**
 * The versions of the API, newest first: the day of each release the
 * changelog records (`2026-11-09`).
 */
export const apiVersions: readonly string[] = apiChangelog.entries.map(
  (entry) => entry.date
);

/**
 * The version the server speaks: its latest release's day. A client that
 * sends an older one is answered as every client is, since the API only
 * grows; the server counts who sends which, for the day a break needs
 * versions it translates.
 */
export const apiVersion: string = apiVersions[0] ?? "";
