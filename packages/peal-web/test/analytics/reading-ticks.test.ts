import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";

import { readingTicksOf } from "#analytics/reading-ticks.ts";

const at = (iso: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso));

// Each tick as an instant and what it shows.
const shown = (first: string, last: string, timeZone = "Europe/Paris") =>
  readingTicksOf(at(first), at(last), timeZone).map(
    ({ at: tick, label }) => [new Date(tick).toISOString(), label] as const
  );

describe(readingTicksOf, () => {
  it("marks the hours of readings less than two days apart, with the day where it changes", () => {
    // 12:00 in Paris on the 24th to 18:00 on the 25th: every 12 hours.
    expect(shown("2026-11-24T11:00:00Z", "2026-11-25T17:00:00Z")).toStrictEqual(
      [
        ["2026-11-24T11:00:00.000Z", "dayTime"],
        ["2026-11-24T23:00:00.000Z", "dayTime"],
        ["2026-11-25T11:00:00.000Z", "time"],
      ]
    );
  });

  it("marks every hour of readings a few hours apart, never the day twice", () => {
    expect(shown("2026-11-24T10:20:00Z", "2026-11-24T13:40:00Z")).toStrictEqual(
      [
        ["2026-11-24T11:00:00.000Z", "dayTime"],
        ["2026-11-24T12:00:00.000Z", "time"],
        ["2026-11-24T13:00:00.000Z", "time"],
      ]
    );
  });

  it("marks the readings themselves when no hour falls between them", () => {
    expect(shown("2026-11-24T10:05:00Z", "2026-11-24T10:50:00Z")).toStrictEqual(
      [
        ["2026-11-24T10:05:00.000Z", "dayTime"],
        ["2026-11-24T10:50:00.000Z", "time"],
      ]
    );
  });

  it("marks the days of readings two days apart or more, at the reader's midnight", () => {
    expect(
      shown("2026-11-20T11:00:00Z", "2026-11-24T17:00:00Z", "Pacific/Auckland")
    ).toStrictEqual([
      ["2026-11-20T11:00:00.000Z", "day"],
      ["2026-11-21T11:00:00.000Z", "day"],
      ["2026-11-22T11:00:00.000Z", "day"],
      ["2026-11-23T11:00:00.000Z", "day"],
      ["2026-11-24T11:00:00.000Z", "day"],
    ]);
  });

  it("marks fewer days over a month, each one once", () => {
    const ticks = shown("2026-10-11T08:00:00Z", "2026-11-10T08:00:00Z");

    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(new Set(ticks.map(([tick]) => tick.slice(0, 10))).size).toBe(
      ticks.length
    );
    expect(ticks.map(([, label]) => label)).toStrictEqual(
      ticks.map(() => "day")
    );
  });
});
