import { DateTime } from "effect";
import type { AgentChat, AgentMessage } from "peal-contract/agent";

/**
 * How long ago a chat moved, in the largest whole unit: `now` under a
 * minute, then minutes, hours, days and weeks, negative as `Intl`'s
 * relative time takes it.
 */
export type Age =
  | { readonly unit: "now" }
  | {
      readonly unit: "day" | "hour" | "minute" | "week";
      readonly value: number;
    };

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const week = 7 * day;

export const ageOf = (then: DateTime.Utc, now: DateTime.Utc): Age => {
  const gone = DateTime.toEpochMillis(now) - DateTime.toEpochMillis(then);

  if (gone < minute) {
    return { unit: "now" };
  }

  if (gone < hour) {
    return { unit: "minute", value: -Math.floor(gone / minute) };
  }

  if (gone < day) {
    return { unit: "hour", value: -Math.floor(gone / hour) };
  }

  return gone < week
    ? { unit: "day", value: -Math.floor(gone / day) }
    : { unit: "week", value: -Math.floor(gone / week) };
};

// The calendar day of an instant on a clock, as YYYY-MM-DD.
const dayKey = (instant: DateTime.Utc, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(DateTime.toDate(instant));

/** Whether an instant is today on the reader's clock, yesterday, or before. */
export const relativeDayOf = (
  at: DateTime.Utc,
  now: DateTime.Utc,
  timeZone: string
): "other" | "today" | "yesterday" => {
  const key = dayKey(at, timeZone);

  if (key === dayKey(now, timeZone)) {
    return "today";
  }

  return key === dayKey(DateTime.subtract(now, { days: 1 }), timeZone)
    ? "yesterday"
    : "other";
};

/** A group of the history: today's chats, yesterday's, or a day's. */
export interface DayGroup {
  /** `today`, `yesterday`, or the day's first chat's time, to name it. */
  readonly day: "today" | "yesterday" | DateTime.Utc;
  readonly key: string;
  readonly chats: readonly AgentChat[];
}

const dayOf = (
  key: string,
  near: { readonly today: string; readonly yesterday: string },
  first: DateTime.Utc
): DayGroup["day"] => {
  if (key === near.today) {
    return "today";
  }

  return key === near.yesterday ? "yesterday" : first;
};

/**
 * The chats by the day they last moved on the reader's clock, the latest
 * first, as the chat switcher lists them.
 */
export const dayGroupsOf = (
  chats: readonly AgentChat[],
  now: DateTime.Utc,
  timeZone: string
): readonly DayGroup[] => {
  const today = dayKey(now, timeZone);
  const yesterday = dayKey(DateTime.subtract(now, { days: 1 }), timeZone);

  const groups: { key: string; day: DayGroup["day"]; chats: AgentChat[] }[] =
    [];

  const sorted = chats.toSorted(
    (a, b) =>
      DateTime.toEpochMillis(b.updatedAt) - DateTime.toEpochMillis(a.updatedAt)
  );

  for (const chat of sorted) {
    const key = dayKey(chat.updatedAt, timeZone);
    const last = groups.at(-1);

    if (last?.key === key) {
      last.chats.push(chat);
    } else {
      groups.push({
        chats: [chat],
        day: dayOf(key, { today, yesterday }, chat.updatedAt),
        key,
      });
    }
  }

  return groups;
};

/** What a transcript calls each side, in the reader's language. */
export interface TranscriptNames {
  readonly agent: string;
  readonly person: string;
  readonly title: string;
}

/**
 * The chat as markdown, for **Copy as markdown**: its title, then each
 * message under who wrote it. The agent's text is markdown already; the
 * person's is copied as they wrote it.
 */
export const transcriptOf = (
  messages: readonly Pick<AgentMessage, "role" | "text">[],
  names: TranscriptNames
): string =>
  [
    `# ${names.title}`,
    ...messages.flatMap(({ role, text }) =>
      text.trim() === ""
        ? []
        : [
            `**${role === "user" ? names.person : names.agent}**\n\n${text.trim()}`,
          ]
    ),
  ].join("\n\n");
