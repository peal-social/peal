import { DateTime } from "effect";
import type { Option } from "effect";

import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import type { Locale } from "#shared/domain/locale.ts";

/**
 * The week a digest tells, in UTC, as readers' time zones are not known:
 * the seven days from `from` to `to`, and the seven after, to `until`.
 */
export interface DigestWeek {
  readonly from: DateTime.Utc;
  readonly to: DateTime.Utc;
  readonly until: DateTime.Utc;
}

/**
 * The week a digest sent at `at` tells: the one that ended at the last
 * Monday's midnight UTC, `at` itself when it is one, and the one it began.
 */
export const digestWeekOf = (at: DateTime.Utc): DigestWeek => {
  const to = DateTime.startOf(at, "week", { weekStartsOn: 1 });

  return {
    from: DateTime.subtract(to, { days: 7 }),
    to,
    until: DateTime.add(to, { days: 7 }),
  };
};

/**
 * Names a person's digest of a week, so it goes once: ids and a day,
 * never content.
 */
export const digestKeyOf = (userId: UserId, week: DigestWeek): string =>
  `weekly-digest:${userId}:${DateTime.formatIsoDate(week.from)}`;

/** How many posts of each week a workspace's part lists, at most. */
export const digestListed = 5;

/** A post a digest names: its time and the start of its text. */
export interface DigestPost {
  readonly at: DateTime.Utc;
  readonly excerpt: string;
}

/** What a digest counts of a workspace's posts, by the time each had. */
export interface DigestCounts {
  /** Planned in the week after, waiting for an approval. */
  readonly awaitingApproval: number;
  /** Failed on every channel in the week. */
  readonly failed: number;
  /** Scheduled in the week after. */
  readonly scheduled: number;
  /** Ended in the week without knowing whether they went out. */
  readonly unconfirmed: number;
  /** Went out in the week, on every channel or some. */
  readonly wentOut: number;
}

/** Engagement with the week's posts, as analytics last counted it. */
export interface DigestEngagement {
  readonly engagement: number;
  /** None where no platform of the workspace counts them. */
  readonly impressions: Option.Option<number>;
}

/**
 * A workspace's part of a digest: the workspace's own posts, counted and
 * the first of each week named by the start of their text. Never a
 * comment, nor who wrote one.
 */
export interface DigestWorkspace {
  readonly counts: DigestCounts;
  /** None where the reader may not read the workspace's analytics. */
  readonly engagement: Option.Option<DigestEngagement>;
  readonly name: string;
  /** The first of those planned in the week after, by time. */
  readonly planned: readonly DigestPost[];
  /** The first of those that went out in the week, by time. */
  readonly wentOut: readonly DigestPost[];
  readonly workspaceId: WorkspaceId;
}

/** Whether a workspace's part tells anything: nothing counted, nothing sent. */
export const hasNews = ({ counts }: DigestWorkspace): boolean =>
  Object.values(counts).some((count) => count > 0);

/** A workspace's part, with the page it links to. */
export interface LinkedDigestWorkspace extends DigestWorkspace {
  /** The workspace's calendar, in the reader's language. */
  readonly calendarUrl: string;
}

/** A person's digest, as an email in their language. */
export interface DigestEmail {
  /** Where its button opens: a workspace's calendar, in their language. */
  readonly calendarUrl: string;
  readonly locale: Locale;
  /** Where they turn the digest off, in their language. */
  readonly preferencesUrl: string;
  readonly week: DigestWeek;
  readonly workspaces: readonly LinkedDigestWorkspace[];
}
