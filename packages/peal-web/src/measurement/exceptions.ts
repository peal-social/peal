import type { ClientErrorReport } from "peal-contract";

/**
 * The error the SDK is handed for a report the intake was sent: its
 * message and its stack are the report's, already redacted, so PostHog
 * never receives what the intake would not have.
 */
export const errorOfReport = (report: ClientErrorReport): Error => {
  const error = new Error(report.message);

  // Never the stack of where this error was made: the report's, or none.
  error.stack = report.stack ?? `Error: ${report.message}`;

  return error;
};

/** What an exception carries besides its error. */
export type ExceptionProperties = Readonly<{
  error_kind: ClientErrorReport["kind"];
  release: string;
}>;

/** What the exception carries besides: the report's kind and release. */
export const exceptionPropertiesOf = (
  report: ClientErrorReport
): ExceptionProperties => ({
  error_kind: report.kind,
  release: report.release,
});
