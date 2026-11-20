import { Metric } from "effect";
import { apiVersion, apiVersionHeader, apiVersions } from "peal-contract";

/**
 * Requests of the API, by the version their client says it was written
 * against (`Peal-Version`): a release's day, `none` when it says none, or
 * `unknown` for anything else, so the count has as many series as the API
 * has releases. It tells who still calls with an old version, the day a
 * break needs the server to translate for them.
 */
export const apiVersionRequests = Metric.counter("peal.api.versions", {
  description: "Requests of the API, by the version their client sent",
  incremental: true,
});

const known = new Set(apiVersions);

/** The version a request names, as `apiVersionRequests` counts it. */
export const sentVersionOf = (sent: string | undefined): string => {
  if (sent === undefined || sent.trim() === "") {
    return "none";
  }

  return known.has(sent.trim()) ? sent.trim() : "unknown";
};

// What probes call every few seconds, and no client of the API writes to.
const probes = new Set(["/api/health", "/api/ready"]);

/** Whether a request of this path is counted by the version it sent. */
export const countsVersion = (path: string): boolean =>
  path.startsWith("/api/") && !probes.has(path);

/** Counts a request of the API under the version its client sent. */
export const countSentVersion = (sent: string | undefined) =>
  Metric.update(
    Metric.withAttributes(apiVersionRequests, { version: sentVersionOf(sent) }),
    1
  );

/** The header every answer carries: the version the server speaks. */
export const versionHeaders = {
  [apiVersionHeader]: apiVersion,
};
