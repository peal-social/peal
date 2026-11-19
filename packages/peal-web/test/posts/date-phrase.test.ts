import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { readPhrase } from "#posts/date-phrase.ts";
import type { NumericOrder } from "#posts/date-phrase.ts";
import { dateKey, timeKey } from "#posts/zoned-time.ts";
import type { WallClock } from "#posts/zoned-time.ts";

// Thursday, November 19, 2026, at 14:05.
const now: WallClock = {
  date: { day: 19, month: 11, year: 2026 },
  time: { hour: 14, minute: 5 },
};

// What a phrase reads as: "YYYY-MM-DD HH:mm", "YYYY-MM-DD" without a time,
// or null for a phrase that names nothing.
const read = (phrase: string, order: NumericOrder = "monthFirst") =>
  Option.match(readPhrase(phrase, now, order), {
    onNone: () => null,
    onSome: ({ date, time }) =>
      Option.match(time, {
        onNone: () => dateKey(date),
        onSome: (clock) => `${dateKey(date)} ${timeKey(clock)}`,
      }),
  });

// What each phrase reads as, keyed by the phrase, to compare in one go.
const readAll = (cases: Readonly<Record<string, string | null>>) =>
  Object.fromEntries(
    Object.keys(cases).map((phrase) => [phrase, read(phrase)])
  );

describe(readPhrase, () => {
  it("reads days counted from today, in English and in French", () => {
    const cases = {
      "aujourd’hui": "2026-11-19",
      "après-demain": "2026-11-21",
      demain: "2026-11-20",
      today: "2026-11-19",
      tomorrow: "2026-11-20",
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });

  it("reads a weekday as the coming one, and “next” as the week after", () => {
    const cases = {
      friday: "2026-11-20",
      lundi: "2026-11-23",
      "next friday": "2026-11-27",
      "this friday": "2026-11-20",
      thursday: "2026-11-26",
      "vendredi prochain": "2026-11-27",
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });

  it("reads a time, with or without a day", () => {
    const cases = {
      "demain midi": "2026-11-20 12:00",
      "demain à 10h30": "2026-11-20 10:30",
      "monday at 3 pm": "2026-11-23 15:00",
      "next friday 10:30": "2026-11-27 10:30",
      "tomorrow 9am": "2026-11-20 09:00",
      "tomorrow noon": "2026-11-20 12:00",
      "vendredi 18h": "2026-11-20 18:00",
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });

  it("puts a time alone today while it is to come, tomorrow otherwise", () => {
    const cases = {
      "14:05": "2026-11-20 14:05",
      "6pm": "2026-11-19 18:00",
      "9am": "2026-11-20 09:00",
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });

  it("counts days, weeks, months, hours and minutes from now", () => {
    const cases = {
      "dans 2 semaines": "2026-12-03",
      "dans 30 minutes": "2026-11-19 14:35",
      "in 10 hours": "2026-11-20 00:05",
      "in 2 hours": "2026-11-19 16:05",
      "in 3 days": "2026-11-22",
      "in 3 days 9am": "2026-11-22 09:00",
      "in a month": "2026-12-19",
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });

  it("reads written dates, in the next year once this one's has passed", () => {
    const cases = {
      "2026-12-24 08:00": "2026-12-24 08:00",
      "27 mar": "2027-03-27",
      "27 novembre 10h": "2026-11-27 10:00",
      "jan 5 2028": "2028-01-05",
      "le 1er décembre": "2026-12-01",
      "march 3": "2027-03-03",
      "nov 27": "2026-11-27",
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });

  it("reads a numeric date in the order of the page's language", () => {
    expect([
      read("12/3", "monthFirst"),
      read("12/3", "dayFirst"),
    ]).toStrictEqual(["2026-12-03", "2027-03-12"]);
  });

  it("names nothing for a word it does not understand", () => {
    const cases = {
      "": null,
      "25:00": null,
      "feb 30": null,
      someday: null,
      "tomorrow friday": null,
      "tomorrow maybe": null,
    };

    expect(readAll(cases)).toStrictEqual(cases);
  });
});
