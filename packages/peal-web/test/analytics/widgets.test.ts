import { describe, expect, it } from "@effect/vitest";

import {
  addWidget,
  boardFrom,
  boardText,
  channelOf,
  defaultBoard,
  duplicateWidget,
  kinds,
  matches,
  maxTitleLength,
  moveWidget,
  periodOf,
  periodRange,
  removeWidget,
  renameWidget,
  reportPeriods,
  setChannel,
  setPeriod,
  sumOf,
  widgetKinds,
} from "#analytics/widgets.ts";
import type { Board, FigureDay } from "#analytics/widgets.ts";

const board: Board = {
  version: 1,
  widgets: [
    { id: "a", kind: "followers" },
    { id: "b", kind: "topPosts" },
    { id: "c", kind: "activity" },
  ],
};

const ids = (shown: Board) => shown.widgets.map(({ id }) => id);

describe(boardFrom, () => {
  it("reads the board it kept", () => {
    expect(boardFrom(boardText(board))).toStrictEqual(board);
  });

  it("starts with the default board when nothing reads", () => {
    expect(boardFrom(null)).toStrictEqual(defaultBoard);
    expect(boardFrom("not json")).toStrictEqual(defaultBoard);
    expect(
      boardFrom(
        JSON.stringify({ version: 1, widgets: [{ id: "x", kind: "pie" }] })
      )
    ).toStrictEqual(defaultBoard);
  });

  it("gives every default widget a kind it describes", () => {
    for (const widget of defaultBoard.widgets) {
      expect(widgetKinds).toContain(widget.kind);
    }

    expect(new Set(ids(defaultBoard)).size).toBe(defaultBoard.widgets.length);
  });
});

describe("changing the board", () => {
  it("adds at the end and removes by id", () => {
    const added = addWidget(board, "export", "d");

    expect(ids(added)).toStrictEqual(["a", "b", "c", "d"]);
    expect(ids(removeWidget(added, "b"))).toStrictEqual(["a", "c", "d"]);
  });

  it("duplicates right after, filters and all", () => {
    const filtered = setPeriod(board, "a", "7");
    const copied = duplicateWidget(filtered, "a", "a2");

    expect(ids(copied)).toStrictEqual(["a", "a2", "b", "c"]);
    expect(copied.widgets[1]).toStrictEqual({
      id: "a2",
      kind: "followers",
      period: "7",
    });
  });

  it("names a widget, cut to the longest name, and gives the kind's back when empty", () => {
    const named = renameWidget(board, "a", `  ${"x".repeat(80)} `);

    expect(named.widgets[0]?.title).toHaveLength(maxTitleLength);
    expect(renameWidget(named, "a", "   ").widgets[0]).toStrictEqual({
      id: "a",
      kind: "followers",
    });
  });

  it("keeps a period only when it is not the kind's own", () => {
    expect(setPeriod(board, "a", "90").widgets[0]?.period).toBe("90");
    expect(setPeriod(board, "a", "30").widgets[0]).toStrictEqual({
      id: "a",
      kind: "followers",
    });
  });

  it("moves a widget to a place among the others", () => {
    expect(ids(moveWidget(board, "c", 0))).toStrictEqual(["c", "a", "b"]);
    expect(ids(moveWidget(board, "a", 2))).toStrictEqual(["b", "c", "a"]);
    expect(ids(moveWidget(board, "a", 99))).toStrictEqual(["b", "c", "a"]);
    expect(moveWidget(board, "z", 0)).toBe(board);
  });
});

describe(periodOf, () => {
  it("falls back on the kind's period for one it does not offer", () => {
    expect(periodOf({ id: "a", kind: "bestTimes", period: "month" })).toBe(
      "90"
    );
    expect(periodOf({ id: "a", kind: "followers", period: "180" })).toBe("30");
    expect(periodOf({ id: "a", kind: "followers", period: "year" })).toBe(
      "year"
    );
    expect(kinds.followers.periods).toStrictEqual(reportPeriods);
  });
});

describe(channelOf, () => {
  it("shows the channel chosen while the workspace has it", () => {
    const [widget] = setChannel(board, "a", "ch1").widgets;

    expect(widget === undefined ? null : channelOf(widget, ["ch1"])).toBe(
      "ch1"
    );
    expect(widget === undefined ? null : channelOf(widget, ["ch2"])).toBeNull();
  });

  it("gives best times the first channel when none is chosen", () => {
    expect(channelOf({ id: "x", kind: "bestTimes" }, ["ch1", "ch2"])).toBe(
      "ch1"
    );
    expect(channelOf({ id: "x", kind: "bestTimes" }, [])).toBeNull();
    expect(
      channelOf({ channelId: "ch1", id: "x", kind: "topPosts" }, ["ch1"])
    ).toBeNull();
  });
});

describe(periodRange, () => {
  const today = { day: 15, month: 8, year: 2026 };

  it("counts the last days, today included", () => {
    expect(periodRange("7", today, "UTC")).toStrictEqual({
      from: "2026-08-09",
      timeZone: "UTC",
      to: "2026-08-15",
    });
    expect(periodRange("365", today, "UTC").from).toBe("2025-08-16");
  });

  it("starts the month, the quarter and the year so far", () => {
    expect(periodRange("month", today, "UTC").from).toBe("2026-08-01");
    expect(periodRange("quarter", today, "UTC").from).toBe("2026-07-01");
    expect(periodRange("year", today, "UTC").from).toBe("2026-01-01");
  });
});

const day = (views: number | null): FigureDay => ({
  date: "2026-08-01",
  engagement: 0,
  followers: null,
  likes: 0,
  quotes: 0,
  reach: null,
  replies: 0,
  reposts: 0,
  views,
});

describe(sumOf, () => {
  it("adds what was given, and is null when nothing was", () => {
    expect(sumOf([day(3), day(null), day(4)], "views")).toBe(7);
    expect(sumOf([day(null)], "views")).toBeNull();
  });
});

describe(matches, () => {
  it("finds every word, in any case", () => {
    expect(matches("top POSTS", "Top posts", "The posts")).toBeTruthy();
    expect(matches("follow", "Top posts", "The posts")).toBeFalsy();
    expect(matches("  ", "Anything")).toBeTruthy();
  });
});
