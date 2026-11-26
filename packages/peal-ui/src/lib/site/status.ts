import { Schema } from "effect";

// Whether Peal is up, from the public status page's checks (the uptime
// server's status Gatus, on status.peal.social), for the footer's status
// icon. The page lets the public sites read its checks (the uptime role's
// status.caddy); anything else the browser gets leaves the icon neutral.

/** The checks the status page's API lists, each with its last results. */
export const StatusChecksSchema = Schema.Array(
  Schema.Struct({
    results: Schema.Array(Schema.Struct({ success: Schema.Boolean })),
  })
);

export type StatusChecks = typeof StatusChecksSchema.Type;

export type SiteStatus = "degraded" | "down" | "up";

/**
 * Peal's status from the checks' last results: up when every check passed,
 * down when none did, degraded in between; nothing when no check has a
 * result yet.
 */
export const statusOf = (checks: StatusChecks): SiteStatus | undefined => {
  const last = checks.flatMap((check) => {
    const result = check.results.at(-1);

    return result === undefined ? [] : [result.success];
  });

  const failing = last.filter((success) => !success).length;

  if (last.length === 0) {
    return undefined;
  }

  if (failing === 0) {
    return "up";
  }

  return failing === last.length ? "down" : "degraded";
};

/** Where the status page's API lists its checks, each with its last result. */
export const statusApiOf = (statusPage: string) =>
  `${statusPage.replace(/\/+$/u, "")}/api/v1/endpoints/statuses?page=1&pageSize=1`;
