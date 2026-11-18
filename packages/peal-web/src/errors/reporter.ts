import type { ClientErrorReport } from "peal-contract";

/** How many reports a page sends at most, however many errors it meets. */
export const maxReportsPerPage = 10;

/**
 * Sends each report once: the same error met again, as in a render loop,
 * is not sent twice, and a page sends `maxReportsPerPage` at most.
 */
export const makeReporter = (send: (report: ClientErrorReport) => void) => {
  const seen = new Set<string>();

  return (report: ClientErrorReport): void => {
    const key = `${report.kind}\n${report.message}\n${report.path}`;

    if (seen.size >= maxReportsPerPage || seen.has(key)) {
      return;
    }

    seen.add(key);
    send(report);
  };
};

/** Someone told of each report the intake is sent. */
export type ReportListener = (report: ClientErrorReport) => void;

/**
 * A reporter that also hands each report it sends, and no other (not a
 * duplicate, not one past the page's limit), to whoever listens: the web
 * app's measurement, while it runs.
 */
export const makeReportChannel = (
  send: (report: ClientErrorReport) => void
) => {
  const listeners = new Set<ReportListener>();

  const report = makeReporter((sent) => {
    send(sent);

    for (const listener of listeners) {
      listener(sent);
    }
  });

  /** Listens until the function it answers is called. */
  const listen = (listener: ReportListener): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  return { listen, report };
};
