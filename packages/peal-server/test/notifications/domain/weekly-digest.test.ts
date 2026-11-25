import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option } from "effect";

import {
  digestKeyOf,
  digestWeekOf,
  hasNews,
} from "#notifications/domain/weekly-digest.ts";
import type { LinkedDigestWorkspace } from "#notifications/domain/weekly-digest.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";

const utc = (iso: string) => DateTime.makeUnsafe(iso);

const iso = (instant: DateTime.Utc) => DateTime.formatIso(instant);

const workspaceId = WorkspaceIdSchema.make(
  "2f9a3c1e-7d4b-4e8f-9a1c-3b5d7e9f1a2c"
);

const week = digestWeekOf(utc("2026-11-16T06:23:00Z"));

const studio: LinkedDigestWorkspace = {
  calendarUrl: "https://app.example.test/2f9a/calendar",
  counts: {
    awaitingApproval: 1,
    failed: 1,
    scheduled: 6,
    unconfirmed: 0,
    wentOut: 7,
  },
  engagement: Option.some({ engagement: 1234, impressions: Option.none() }),
  name: "Studio <Nord> & Co",
  planned: [
    { at: utc("2026-11-17T08:00:00Z"), excerpt: "Launch day <b>soon</b>" },
  ],
  wentOut: [
    { at: utc("2026-11-10T09:30:00Z"), excerpt: "Autumn sale" },
    { at: utc("2026-11-11T09:30:00Z"), excerpt: "" },
  ],
  workspaceId,
};

describe(digestWeekOf, () => {
  it("tells the week that ended at the last Monday's midnight UTC, and the week it began", () => {
    expect(iso(week.from)).toBe("2026-11-09T00:00:00.000Z");
    expect(iso(week.to)).toBe("2026-11-16T00:00:00.000Z");
    expect(iso(week.until)).toBe("2026-11-23T00:00:00.000Z");

    // A run late on the Sunday still tells the week before.
    expect(iso(digestWeekOf(utc("2026-11-22T23:59:00Z")).to)).toBe(
      "2026-11-16T00:00:00.000Z"
    );
  });

  it("names a person's digest of a week by ids and a day, never content", () => {
    expect(
      digestKeyOf(
        UserIdSchema.make("6c1d9e0a-2b3f-4a5c-8d7e-9f0a1b2c3d4e"),
        week
      )
    ).toBe("weekly-digest:6c1d9e0a-2b3f-4a5c-8d7e-9f0a1b2c3d4e:2026-11-09");
  });
});

describe(hasNews, () => {
  it("is false for a workspace whose fortnight holds no post", () => {
    expect(hasNews(studio)).toBeTruthy();
    expect(
      hasNews({
        ...studio,
        counts: {
          awaitingApproval: 0,
          failed: 0,
          scheduled: 0,
          unconfirmed: 0,
          wentOut: 0,
        },
      })
    ).toBeFalsy();
  });
});
