// Errors reach the measurement only as the intake was sent them: the same
// reports, once each, ten a page, already redacted.
import { describe, expect, it } from "@effect/vitest";
import type { ClientErrorReport } from "peal-contract";

import { reportOf } from "#errors/report.ts";
import { makeReportChannel, maxReportsPerPage } from "#errors/reporter.ts";
import {
  errorOfReport,
  exceptionPropertiesOf,
} from "#measurement/exceptions.ts";

const place = {
  kind: "uncaught" as const,
  page: "/app",
  release: "synthetic-release",
  route: null,
  userAgent: null,
};

const reportNamed = (message: string) => reportOf(new Error(message), place);

describe(makeReportChannel, () => {
  it("hands its listener exactly the reports it sends", () => {
    const sent: ClientErrorReport[] = [];
    const heard: ClientErrorReport[] = [];

    const channel = makeReportChannel((report) => {
      sent.push(report);
    });

    const stop = channel.listen((report) => {
      heard.push(report);
    });

    channel.report(reportNamed("first"));
    // The same error again, as in a render loop.
    channel.report(reportNamed("first"));

    for (let index = 0; index < maxReportsPerPage + 1; index += 1) {
      channel.report(reportNamed(`error ${index}`));
    }

    expect(sent).toHaveLength(maxReportsPerPage);
    expect(heard).toStrictEqual(sent);

    stop();
    channel.report(reportNamed("after"));

    expect(heard).toHaveLength(maxReportsPerPage);
  });
});

describe(errorOfReport, () => {
  it("holds the report's redacted message and stack, never the raw ones", () => {
    const raw = new Error(
      "Failed for someone@example.test on 4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70 with peal_synthetic_key at https://app.peal.test/reset?token=secret"
    );

    raw.stack = `Error: ${raw.message}\n    at https://app.peal.test/_next/x.js?token=secret:1:2`;

    const report = reportOf(raw, place);
    const error = errorOfReport(report);

    expect(error.message).toBe(report.message);
    expect(error.stack).toBe(report.stack);

    for (const leaked of [
      "someone@example.test",
      "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70",
      "peal_synthetic_key",
      "token=secret",
    ]) {
      expect(error.message).not.toContain(leaked);
      expect(error.stack).not.toContain(leaked);
    }

    expect(exceptionPropertiesOf(report)).toStrictEqual({
      error_kind: "uncaught",
      release: "synthetic-release",
    });
  });
});
