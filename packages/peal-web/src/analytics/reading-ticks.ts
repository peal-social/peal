import { DateTime, Duration } from "effect";

// Where a post's readings chart marks its time axis, in the reader's zone:
// days for readings two days apart or more, hours for closer ones, so a
// day is never written twice in a row.

/** What a tick shows: the day, the time, or both where the day changes. */
export type TickLabel = "day" | "dayTime" | "time";

export interface ReadingTick {
  /** The instant, in milliseconds since the epoch. */
  readonly at: number;
  readonly label: TickLabel;
}

// From this span on, the axis marks days.
const daysFrom = Duration.days(2);

// The most ticks a span of hours takes, and of days: few enough for a
// phone, where the chart is about 300 px wide.
const mostHourTicks = 4;
const mostDayTicks = 8;

const hourSteps = [1, 2, 3, 6, 12] as const;
const daySteps = [1, 2, 3, 7, 14, 30] as const;

const zoned = (at: number, timeZone: string) =>
  DateTime.makeZonedUnsafe(at, { timeZone });

// The instants from `first`'s start of `part` on, `step` parts apart,
// that fall in [first, last], each on a multiple of `step` (an hour of
// the day, or a day from the first).
const marks = (
  first: number,
  last: number,
  timeZone: string,
  part: "day" | "hour",
  step: number
): readonly number[] => {
  const found: number[] = [];
  let mark = DateTime.startOf(zoned(first, timeZone), part);

  while (DateTime.toEpochMillis(mark) <= last) {
    const at = DateTime.toEpochMillis(mark);

    const onStep = part === "day" || DateTime.toParts(mark).hour % step === 0;

    if (at >= first && onStep) {
      found.push(at);
    }

    mark = DateTime.add(mark, part === "day" ? { days: 1 } : { hours: 1 });
  }

  return part === "day"
    ? found.filter((_, index) => index % step === 0)
    : found;
};

const dayOf = (at: number, timeZone: string) => {
  const { day, month, year } = DateTime.toParts(zoned(at, timeZone));

  return `${String(year)}-${String(month)}-${String(day)}`;
};

// Times, with the day on the first and wherever it changes.
const timesOf = (
  ticks: readonly number[],
  timeZone: string
): readonly ReadingTick[] =>
  ticks.map((at, index) => {
    const before = ticks[index - 1];

    return {
      at,
      label:
        before === undefined || dayOf(before, timeZone) !== dayOf(at, timeZone)
          ? "dayTime"
          : "time",
    };
  });

/** The ticks of a chart whose readings run from `first` to `last`. */
export const readingTicksOf = (
  first: number,
  last: number,
  timeZone: string
): readonly ReadingTick[] => {
  if (
    Duration.isGreaterThanOrEqualTo(Duration.millis(last - first), daysFrom)
  ) {
    const step =
      daySteps.find(
        (days) =>
          marks(first, last, timeZone, "day", days).length <= mostDayTicks
      ) ?? 30;

    return marks(first, last, timeZone, "day", step).map((at) => ({
      at,
      label: "day",
    }));
  }

  const hours =
    hourSteps
      .map((step) => marks(first, last, timeZone, "hour", step))
      .find((found) => found.length <= mostHourTicks) ?? [];

  // No hour falls between them: the readings themselves.
  return timesOf(hours.length === 0 ? [first, last] : hours, timeZone);
};
