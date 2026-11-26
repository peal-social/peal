// The footer's status icon reads the status page's checks: their last
// results say whether Peal is up, and anything else says nothing.
import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  StatusChecksSchema,
  statusApiOf,
  statusOf,
} from "../src/lib/site/status.ts";

const check = (...results: boolean[]) => ({
  group: "Peal production",
  key: "peal-production_api",
  name: "API",
  results: results.map((success) => ({ status: 200, success })),
});

// The footer decodes the API's answer, then reads it.
const decode = Schema.decodeUnknownOption(StatusChecksSchema);

describe("the footer's status", () => {
  it("is up when every check's last result passed", () => {
    expect(statusOf([check(true), check(false, true)])).toBe("up");
  });

  it("is degraded when some checks fail", () => {
    expect(statusOf([check(true), check(false)])).toBe("degraded");
  });

  it("is down when every check fails", () => {
    expect(statusOf([check(false), check(true, false)])).toBe("down");
  });

  it("says nothing while no check has a result", () => {
    expect(statusOf([])).toBeUndefined();
    expect(statusOf([check()])).toBeUndefined();
  });

  it("reads the API's own answer", () => {
    expect(
      Option.map(decode([check(true), check(false)]), statusOf)
    ).toStrictEqual(Option.some("degraded"));
  });

  it.each([
    ["an error page", "<html>Bad gateway</html>"],
    ["another shape", { status: "ok" }],
    ["a check without results", [{ name: "API" }]],
  ])("refuses %s", (_name, answer) => {
    expect(Option.isNone(decode(answer))).toBe(true);
  });

  it("asks the status page's API for each check's last result", () => {
    expect(statusApiOf("https://status.example.com/")).toBe(
      "https://status.example.com/api/v1/endpoints/statuses?page=1&pageSize=1"
    );
  });
});
