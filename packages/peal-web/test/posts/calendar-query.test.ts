import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import {
  calendarQueryOf,
  calendarStateOf,
  defaultState,
} from "#posts/calendar-query.ts";

const today = { day: 19, month: 11, year: 2026 };

const stateOf = (query: string) => calendarStateOf(new URLSearchParams(query));

describe(calendarStateOf, () => {
  it("reads the view, the date and each filter's ids", () => {
    const state = stateOf(
      "view=month&date=2026-12-03&channel=a,b&tag=t&queue=q"
    );

    expect([
      state.view,
      Option.getOrUndefined(state.date),
      state.filter,
    ]).toStrictEqual([
      "month",
      { day: 3, month: 12, year: 2026 },
      { channelIds: ["a", "b"], queueIds: ["q"], tagIds: ["t"] },
    ]);
  });

  it("falls back to the week around today on what it does not know", () => {
    expect(stateOf("view=year&date=tomorrow&channel=,a,a")).toStrictEqual({
      ...defaultState,
      filter: { ...defaultState.filter, channelIds: ["a"] },
    });
  });
});

describe(calendarQueryOf, () => {
  it("leaves the defaults out, and reads back what it writes", () => {
    const query = calendarQueryOf(
      {
        date: Option.some({ day: 3, month: 12, year: 2026 }),
        filter: { channelIds: ["a", "b"], queueIds: [], tagIds: ["t"] },
        view: "day",
      },
      today
    );

    expect([
      query,
      calendarQueryOf(defaultState, today),
      calendarQueryOf({ ...defaultState, date: Option.some(today) }, today),
      stateOf(query).filter,
    ]).toStrictEqual([
      "view=day&date=2026-12-03&channel=a%2Cb&tag=t",
      "",
      "",
      { channelIds: ["a", "b"], queueIds: [], tagIds: ["t"] },
    ]);
  });
});
