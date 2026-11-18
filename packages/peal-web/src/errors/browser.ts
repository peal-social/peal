import type { ClientErrorKind, ClientErrorReport } from "peal-contract";

import { releaseMeta } from "./release-meta.ts";
import { reportOf } from "./report.ts";
import { makeReportChannel } from "./reporter.ts";
import type { ReportListener } from "./reporter.ts";

// The release the page was served by, read before React hydrates: an error
// page that replaces the whole document no longer has the tag.
const served = { release: "unknown" };

/** Reads the page's release from its meta tag, once, before hydration. */
export const rememberRelease = (): void => {
  served.release =
    document
      .querySelector(`meta[name="${releaseMeta}"]`)
      ?.getAttribute("content") ?? served.release;
};

// Without cookies: a report names nobody. A report that fails to go is
// dropped, never reported in turn.
const post = (report: ClientErrorReport): void => {
  fetch("/api/client-errors", {
    body: JSON.stringify(report),
    credentials: "omit",
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Nothing more to do: the error page already shows.
  });
};

const channel = makeReportChannel(post);

/**
 * Hands each report the intake is sent to `listener` too, until the
 * function it answers is called: how errors reach the web app's
 * measurement, already redacted.
 */
export const onReported = (listener: ReportListener): (() => void) =>
  channel.listen(listener);

/** Reports an error the browser met to the server. */
export const reportBrowserError = (
  cause: unknown,
  kind: Exclude<ClientErrorKind, "server">
): void => {
  // The tag may stream in after the page started: look again.
  if (served.release === "unknown") {
    rememberRelease();
  }

  channel.report(
    reportOf(cause, {
      kind,
      page: window.location.pathname,
      release: served.release,
      route: null,
      userAgent: navigator.userAgent,
    })
  );
};
