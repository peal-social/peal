import { describe, expect, it } from "@effect/vitest";

import {
  calendarLayoutQuery,
  layoutOf,
  layoutQuery,
} from "#posts/posts-layout.ts";

const query = (written: string) => new URLSearchParams(written);

describe(layoutOf, () => {
  it("reads the calendar, and the list from anything else", () => {
    expect([
      layoutOf(query("layout=calendar")),
      layoutOf(query("layout=list")),
      layoutOf(query("")),
      layoutOf(query("layout=board")),
    ]).toStrictEqual(["calendar", "list", "list", "list"]);
  });
});

describe(layoutQuery, () => {
  it("carries the shared filters to the calendar, and leaves the list's own", () => {
    expect(
      layoutQuery(
        query("status=draft&sort=created-asc&channel=a&tag=t"),
        "calendar"
      )
    ).toBe("layout=calendar&channel=a&tag=t");
  });

  it("keeps the first of the calendar's ids for the list, and leaves its view and date", () => {
    expect(
      layoutQuery(
        query("layout=calendar&view=month&date=2026-12-03&channel=a,b&queue=q"),
        "list"
      )
    ).toBe("channel=a&queue=q");
  });

  it("writes nothing for the list when nothing is shared", () => {
    expect(layoutQuery(query("layout=calendar&view=day"), "list")).toBe("");
  });
});

describe(calendarLayoutQuery, () => {
  it("puts the layout before the calendar's own query", () => {
    expect([
      calendarLayoutQuery(""),
      calendarLayoutQuery("view=month&tag=t"),
    ]).toStrictEqual(["layout=calendar", "layout=calendar&view=month&tag=t"]);
  });
});
