import { describe, expect, it } from "vitest";

import { exportUrl } from "#analytics/api.ts";
import { fileNameOf } from "#analytics/export-download.ts";

describe(exportUrl, () => {
  it("names the range and the file, never the workspace", () => {
    const url = new URL(
      exportUrl("posts", {
        from: "2026-11-01",
        timeZone: "Europe/Paris",
        to: "2026-11-07",
      }),
      "https://app.peal.example"
    );

    expect(url.pathname).toBe("/api/v1/analytics/export");
    expect(Object.fromEntries(url.searchParams)).toStrictEqual({
      format: "csv",
      from: "2026-11-01",
      kind: "posts",
      timeZone: "Europe/Paris",
      to: "2026-11-07",
    });
  });
});

describe(fileNameOf, () => {
  it("reads the name the server gives", () => {
    expect(fileNameOf('attachment; filename="peal-analytics-posts.csv"')).toBe(
      "peal-analytics-posts.csv"
    );
  });

  it("gives none without one", () => {
    expect(fileNameOf(null)).toBeNull();
    expect(fileNameOf("attachment")).toBeNull();
  });
});
