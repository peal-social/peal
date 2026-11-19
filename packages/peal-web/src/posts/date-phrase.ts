import { Option } from "effect";

import { addDays, dateKey, parseDate, weekdayOf } from "#posts/zoned-time.ts";
import type { CalendarDate, TimeOfDay, WallClock } from "#posts/zoned-time.ts";

// A date written in words, in English or in French whatever the page's
// language ("tomorrow 9am", "vendredi prochain 10h30", "in 3 days",
// "27 nov"), read on the wall clock of the schedule's zone. Whatever the
// phrase holds must be understood: a word left over means the phrase names
// nothing, never a guess.

/** What a phrase names: a day, and a time of day when it gives one. */
export interface PhraseDate {
  readonly date: CalendarDate;
  readonly time: Option.Option<TimeOfDay>;
}

/** How a numeric date is written: month first (11/27) or day first (27/11). */
export type NumericOrder = "dayFirst" | "monthFirst";

/** A table of words, each to a number: a weekday or a month. */
type Words = Readonly<Record<string, number>>;

// Days from 1 (Monday) to 7 (Sunday).
const weekdays = {
  dim: 7,
  dimanche: 7,
  fri: 5,
  friday: 5,
  jeu: 4,
  jeudi: 4,
  lun: 1,
  lundi: 1,
  mar: 2,
  mardi: 2,
  mer: 3,
  mercredi: 3,
  mon: 1,
  monday: 1,
  sam: 6,
  samedi: 6,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
  thu: 4,
  thurs: 4,
  thursday: 4,
  tue: 2,
  tues: 2,
  tuesday: 2,
  ven: 5,
  vendredi: 5,
  wed: 3,
  wednesday: 3,
} satisfies Words;

const months = {
  aout: 8,
  apr: 4,
  april: 4,
  aug: 8,
  august: 8,
  avr: 4,
  avril: 4,
  dec: 12,
  december: 12,
  decembre: 12,
  feb: 2,
  february: 2,
  fev: 2,
  fevr: 2,
  fevrier: 2,
  jan: 1,
  janv: 1,
  january: 1,
  janvier: 1,
  jul: 7,
  juil: 7,
  juillet: 7,
  july: 7,
  jun: 6,
  june: 6,
  juin: 6,
  mai: 5,
  mar: 3,
  march: 3,
  mars: 3,
  may: 5,
  nov: 11,
  november: 11,
  novembre: 11,
  oct: 10,
  october: 10,
  octobre: 10,
  sep: 9,
  sept: 9,
  september: 9,
  septembre: 9,
} satisfies Words;

const lookUp = (words: Words, word: string | undefined): number | undefined =>
  word === undefined ? undefined : words[word];

// Words that join the parts and mean nothing on their own.
const fillers = new Set(["a", "at", "de", "du", "la", "le", "on", "the"]);

// The longest words first, so "mars" is read before "mar".
const alternation = (words: Words) =>
  Object.keys(words)
    .toSorted((left, right) => right.length - left.length)
    .join("|");

const weekdayWords = alternation(weekdays);
const monthWords = alternation(months);

/** The phrase in lower case, without accents or extra spaces. */
export const normalized = (phrase: string): string =>
  phrase
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[’']/gu, " ")
    .replaceAll(/[,.]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();

const isDate = (date: CalendarDate): boolean =>
  Option.isSome(parseDate(dateKey(date)));

const minutesIn = { hour: 60, minute: 1 } as const;

const unitOf = (word: string) => {
  if (/^(?:minutes?|mins?)$/u.test(word)) {
    return "minute";
  }

  if (/^(?:hours?|hrs?|heures?|h)$/u.test(word)) {
    return "hour";
  }

  if (/^(?:days?|jours?)$/u.test(word)) {
    return "day";
  }

  if (/^(?:weeks?|semaines?)$/u.test(word)) {
    return "week";
  }

  return /^(?:months?|mois)$/u.test(word) ? "month" : null;
};

const countOf = (word: string): number | null => {
  if (/^\d+$/u.test(word)) {
    return Number(word);
  }

  return ["a", "an", "one", "un", "une"].includes(word) ? 1 : null;
};

// The day `count` months after `date`, kept within the month it lands in.
const addMonthsKeepingDay = (
  date: CalendarDate,
  count: number
): CalendarDate => {
  const index = date.year * 12 + (date.month - 1) + count;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;

  const lastDay = [31, 30, 29, 28].find((day) => isDate({ day, month, year }));

  return { day: Math.min(date.day, lastDay ?? 28), month, year };
};

// The next date after `today` with that month and day, this year or the
// next; a year written stands.
const nextDate = (
  today: CalendarDate,
  month: number | undefined,
  day: number,
  year: string | undefined
): CalendarDate | null => {
  if (month === undefined) {
    return null;
  }

  if (year !== undefined) {
    const written = Number(year);
    const date = { day, month, year: written < 100 ? 2000 + written : written };

    return isDate(date) ? date : null;
  }

  const thisYear = { day, month, year: today.year };

  if (!isDate(thisYear)) {
    const nextYear = { ...thisYear, year: today.year + 1 };

    return isDate(nextYear) ? nextYear : null;
  }

  return dateKey(thisYear) >= dateKey(today)
    ? thisYear
    : { ...thisYear, year: today.year + 1 };
};

interface Found {
  date: CalendarDate | null;
  time: TimeOfDay | null;
  /** Minutes from now, for "in 2 hours". */
  minutesFromNow: number | null;
}

type Groups = Readonly<Record<string, string | undefined>>;

type Rule = (
  rest: string,
  found: Found,
  now: WallClock,
  order: NumericOrder
) => string;

// Each rule takes what it understands out of the phrase, once, and says
// what it found; a second date or time is not understood.
const takeOnce = (
  rest: string,
  pattern: RegExp,
  take: (groups: Groups) => boolean
): string => {
  const match = pattern.exec(rest);

  if (match === null || !take(match.groups ?? {})) {
    return rest;
  }

  return `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
};

// A time of day, if the hour and minute are on a clock.
const clockOf = (hour: number, minute: number): TimeOfDay | null =>
  hour <= 23 && minute <= 59 ? { hour, minute } : null;

const setTime = (found: Found, time: TimeOfDay | null): boolean => {
  if (found.time !== null || time === null) {
    return false;
  }

  found.time = time;

  return true;
};

const setDate = (found: Found, date: CalendarDate | null): boolean => {
  if (found.date !== null || date === null) {
    return false;
  }

  found.date = date;

  return true;
};

const timeRules: readonly Rule[] = [
  (rest, found) =>
    takeOnce(rest, /\b(?:noon|midday|midi)\b/u, () =>
      setTime(found, { hour: 12, minute: 0 })
    ),
  (rest, found) =>
    takeOnce(rest, /\b(?:midnight|minuit)\b/u, () =>
      setTime(found, { hour: 0, minute: 0 })
    ),
  // 10am, 10:30 pm
  (rest, found) =>
    takeOnce(
      rest,
      /\b(?<hour>\d{1,2})(?::(?<minute>\d{2}))? ?(?<half>am|pm)\b/u,
      ({ half, hour = "", minute = "0" }) => {
        const hours = Number(hour);

        return (
          hours >= 1 &&
          hours <= 12 &&
          setTime(
            found,
            clockOf((hours % 12) + (half === "pm" ? 12 : 0), Number(minute))
          )
        );
      }
    ),
  // 10h, 10h30, 10 h 30
  (rest, found) =>
    takeOnce(
      rest,
      /\b(?<hour>\d{1,2}) ?h ?(?<minute>\d{2})?\b/u,
      ({ hour = "", minute = "0" }) =>
        setTime(found, clockOf(Number(hour), Number(minute)))
    ),
  // 14:30
  (rest, found) =>
    takeOnce(
      rest,
      /\b(?<hour>\d{1,2}):(?<minute>\d{2})\b/u,
      ({ hour = "", minute = "" }) =>
        setTime(found, clockOf(Number(hour), Number(minute)))
    ),
];

const dateRules: readonly Rule[] = [
  // in 3 days, dans 2 semaines, in an hour
  (rest, found, now) =>
    takeOnce(
      rest,
      /\b(?:in|dans) (?<amount>\S+) (?<word>\S+)\b/u,
      ({ amount = "", word = "" }) => {
        const count = countOf(amount);
        const unit = unitOf(word);

        if (count === null || unit === null || found.date !== null) {
          return false;
        }

        if (unit === "minute" || unit === "hour") {
          found.minutesFromNow = count * minutesIn[unit];

          return true;
        }

        return setDate(
          found,
          unit === "month"
            ? addMonthsKeepingDay(now.date, count)
            : addDays(now.date, count * (unit === "week" ? 7 : 1))
        );
      }
    ),
  (rest, found, now) =>
    takeOnce(
      rest,
      /\b(?:day after tomorrow|apres demain|apres-demain)\b/u,
      () => setDate(found, addDays(now.date, 2))
    ),
  (rest, found, now) =>
    takeOnce(rest, /\b(?:tomorrow|tmrw|demain)\b/u, () =>
      setDate(found, addDays(now.date, 1))
    ),
  (rest, found, now) =>
    takeOnce(rest, /\b(?:today|aujourd hui|auj)\b/u, () =>
      setDate(found, now.date)
    ),
  // next week, la semaine prochaine: the Monday after this week
  (rest, found, now) =>
    takeOnce(rest, /\b(?:next week|semaine prochaine)\b/u, () =>
      setDate(found, addDays(now.date, 8 - weekdayOf(now.date)))
    ),
  // 2026-11-27
  (rest, found) =>
    takeOnce(
      rest,
      /\b(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})\b/u,
      ({ day = "", month = "", year = "" }) => {
        const date = {
          day: Number(day),
          month: Number(month),
          year: Number(year),
        };

        return setDate(found, isDate(date) ? date : null);
      }
    ),
  // 27 nov, 27th november 2027, 1er décembre
  (rest, found, now) =>
    takeOnce(
      rest,
      new RegExp(
        `\\b(?<day>\\d{1,2})(?:st|nd|rd|th|er)? (?<month>${monthWords})(?: (?<year>\\d{4}))?\\b`,
        "u"
      ),
      ({ day = "", month, year }) =>
        setDate(
          found,
          nextDate(now.date, lookUp(months, month), Number(day), year)
        )
    ),
  // nov 27, november 27th 2027
  (rest, found, now) =>
    takeOnce(
      rest,
      new RegExp(
        `\\b(?<month>${monthWords}) (?<day>\\d{1,2})(?:st|nd|rd|th)?(?: (?<year>\\d{4}))?\\b`,
        "u"
      ),
      ({ day = "", month, year }) =>
        setDate(
          found,
          nextDate(now.date, lookUp(months, month), Number(day), year)
        )
    ),
  // 11/27 in English, 27/11 in French, a year after them or not
  (rest, found, now, order) =>
    takeOnce(
      rest,
      /\b(?<first>\d{1,2})\/(?<second>\d{1,2})(?:\/(?<year>\d{2,4}))?\b/u,
      ({ first = "", second = "", year }) => {
        const [month, day] =
          order === "monthFirst"
            ? [Number(first), Number(second)]
            : [Number(second), Number(first)];

        return setDate(found, nextDate(now.date, month, day, year));
      }
    ),
  // friday, this friday, on fri, vendredi: the coming such day, never
  // today. next friday, vendredi prochain: the one a week after it.
  // After the written dates, as "mar" is both Tuesday
  // and March.
  (rest, found, now) =>
    takeOnce(
      rest,
      new RegExp(
        `\\b(?:(?<next>next )|this |on )?(?<weekday>${weekdayWords})(?<prochain> prochaine?)?\\b`,
        "u"
      ),
      ({ next, prochain, weekday: word }) => {
        const weekday = lookUp(weekdays, word);

        if (weekday === undefined) {
          return false;
        }

        const ahead = (weekday - weekdayOf(now.date) + 7) % 7;
        const coming = ahead === 0 ? 7 : ahead;
        const later = next === undefined && prochain === undefined ? 0 : 7;

        return setDate(found, addDays(now.date, coming + later));
      }
    ),
];

// "in 2 hours" from now, on the wall clock.
const fromNow = (now: WallClock, minutes: number): WallClock => {
  const total = now.time.hour * 60 + now.time.minute + minutes;
  const days = Math.floor(total / 1440);
  const left = total - days * 1440;

  return {
    date: addDays(now.date, days),
    time: { hour: Math.floor(left / 60), minute: left % 60 },
  };
};

const isLater = (time: TimeOfDay, than: TimeOfDay): boolean =>
  time.hour * 60 + time.minute > than.hour * 60 + than.minute;

/**
 * What a phrase names, read at `now` on the schedule's wall clock: a day,
 * and a time when the phrase gives one. A time alone is today if it is
 * still to come, tomorrow otherwise. None when any word is not understood.
 */
export const readPhrase = (
  phrase: string,
  now: WallClock,
  order: NumericOrder
): Option.Option<PhraseDate> => {
  const found: Found = { date: null, minutesFromNow: null, time: null };
  let rest = ` ${normalized(phrase)} `;

  for (const rule of [...dateRules, ...timeRules]) {
    rest = rule(rest, found, now, order);
  }

  const unread = rest
    .split(" ")
    .filter((word) => word !== "" && !fillers.has(word));

  if (unread.length > 0) {
    return Option.none();
  }

  if (found.minutesFromNow !== null) {
    if (found.time !== null) {
      return Option.none();
    }

    const at = fromNow(now, found.minutesFromNow);

    return Option.some({ date: at.date, time: Option.some(at.time) });
  }

  if (found.date !== null) {
    return Option.some({
      date: found.date,
      time: Option.fromNullishOr(found.time),
    });
  }

  if (found.time !== null) {
    return Option.some({
      date: isLater(found.time, now.time) ? now.date : addDays(now.date, 1),
      time: Option.some(found.time),
    });
  }

  return Option.none();
};
