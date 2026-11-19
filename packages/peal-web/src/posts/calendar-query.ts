import { Option, Schema } from "effect";

import { noFilter } from "#posts/calendar-filter.ts";
import type { CalendarFilter } from "#posts/calendar-filter.ts";
import { DateKeySchema, dateKey, parseDate } from "#posts/zoned-time.ts";
import type { CalendarDate } from "#posts/zoned-time.ts";

// What the calendar shows, kept in the page's address (DESIGN.md, "Filters
// and display"): its view, the date it shows and its filters, so a reload,
// the back button or a link shows the same calendar.

export const CalendarViewSchema = Schema.Literals(["day", "week", "month"]);

export type CalendarView = typeof CalendarViewSchema.Type;

/** The calendar a page shows: the view, the date it is around, the filter. */
export interface CalendarState {
  readonly view: CalendarView;
  /** None: today. */
  readonly date: Option.Option<CalendarDate>;
  readonly filter: CalendarFilter;
}

/** The week around today, everything shown. */
export const defaultState: CalendarState = {
  date: Option.none(),
  filter: noFilter,
  view: "week",
};

/** What the address holds, as `URLSearchParams` reads it. */
interface QueryString {
  readonly get: (name: string) => string | null;
}

const decodeView = Schema.decodeUnknownOption(CalendarViewSchema);
const decodeDateKey = Schema.decodeUnknownOption(DateKeySchema);

// A list of ids, comma separated, each once; an empty one is none.
const idsOf = (value: string | null): readonly string[] =>
  value === null
    ? []
    : [...new Set(value.split(",").filter((id) => id.trim() !== ""))];

/**
 * The calendar an address names. A value it does not know, as a link
 * written by hand may hold, is left out: an unknown view is the week, a
 * date that is no date is today.
 */
export const calendarStateOf = (query: QueryString): CalendarState => ({
  date: decodeDateKey(query.get("date")).pipe(Option.flatMap(parseDate)),
  filter: {
    channelIds: idsOf(query.get("channel")),
    queueIds: idsOf(query.get("queue")),
    tagIds: idsOf(query.get("tag")),
  },
  view: Option.getOrElse(decodeView(query.get("view")), () => "week" as const),
});

const sameDate = (left: CalendarDate, right: CalendarDate): boolean =>
  dateKey(left) === dateKey(right);

/**
 * The address's query for a calendar, without what is its default: the
 * week, today, nothing filtered.
 */
export const calendarQueryOf = (
  state: CalendarState,
  today: CalendarDate
): string =>
  new URLSearchParams([
    ...(state.view === "week" ? [] : [["view", state.view]]),
    ...Option.match(state.date, {
      onNone: () => [],
      onSome: (date) =>
        sameDate(date, today) ? [] : [["date", dateKey(date)]],
    }),
    ...(state.filter.channelIds.length === 0
      ? []
      : [["channel", state.filter.channelIds.join(",")]]),
    ...(state.filter.tagIds.length === 0
      ? []
      : [["tag", state.filter.tagIds.join(",")]]),
    ...(state.filter.queueIds.length === 0
      ? []
      : [["queue", state.filter.queueIds.join(",")]]),
  ]).toString();
