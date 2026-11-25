import { DateTime, Option } from "effect";

import type { EmailCatalog, PluralWords } from "../catalog/email-catalog.ts";
import { catalogs } from "../catalog/index.ts";
import { fill, instantIn } from "../format.ts";
import type { Locale } from "../locale.ts";
import { nameForMail } from "../names.ts";
import { textPart } from "./text-part.ts";

/**
 * The week a digest tells, in UTC, as readers' time zones are not known:
 * the seven days from `from` to `to`, and the seven after, to `until`.
 */
export interface DigestWeek {
  readonly from: DateTime.Utc;
  readonly to: DateTime.Utc;
  readonly until: DateTime.Utc;
}

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
}

/** A workspace's part, with the page it links to. */
export interface LinkedDigestWorkspace extends DigestWorkspace {
  /** The workspace's calendar, in the reader's language. */
  readonly calendarUrl: string;
}

/** A person's digest, as an email in their language. */
export interface WeeklyDigestEmail {
  /** Where its button opens: a workspace's calendar, in their language. */
  readonly calendarUrl: string;
  readonly locale: Locale;
  /** Where they turn the digest off, in their language. */
  readonly preferencesUrl: string;
  readonly week: DigestWeek;
  readonly workspaces: readonly LinkedDigestWorkspace[];
}

const pluralIn = (locale: Locale, words: PluralWords, count: number) =>
  fill(
    new Intl.PluralRules(locale).select(count) === "one"
      ? words.one
      : words.other,
    new Map([["count", new Intl.NumberFormat(locale).format(count)]])
  );

// A day as the digest writes it, in UTC: `to` and `until` are excluded, so
// the last day is the one before.
const dayIn = (instant: DateTime.Utc, locale: Locale) =>
  DateTime.format(instant, { dateStyle: "long", locale, timeZone: "UTC" });

const lastDayBefore = (instant: DateTime.Utc) =>
  DateTime.subtract(instant, { days: 1 });

/**
 * One workspace's part, in the words of the reader's catalog, as lines: the
 * HTML and the text are written from the same ones.
 */
export interface DigestPart {
  readonly calendar: string;
  readonly calendarUrl: string;
  readonly counts: string;
  readonly figures: readonly string[];
  readonly name: string;
  /** The first posts planned, then how many more. */
  readonly planned: readonly string[];
  /** The first posts that went out, then how many more. */
  readonly wentOut: readonly string[];
}

const countsOf = (
  catalog: EmailCatalog,
  locale: Locale,
  counts: DigestCounts
): string =>
  [
    pluralIn(locale, catalog.weeklyDigest.counts.wentOut, counts.wentOut),
    ...(counts.failed > 0
      ? [pluralIn(locale, catalog.weeklyDigest.counts.failed, counts.failed)]
      : []),
    ...(counts.unconfirmed > 0
      ? [
          pluralIn(
            locale,
            catalog.weeklyDigest.counts.unconfirmed,
            counts.unconfirmed
          ),
        ]
      : []),
    pluralIn(locale, catalog.weeklyDigest.counts.scheduled, counts.scheduled),
    ...(counts.awaitingApproval > 0
      ? [
          pluralIn(
            locale,
            catalog.weeklyDigest.counts.awaitingApproval,
            counts.awaitingApproval
          ),
        ]
      : []),
  ].join(" · ");

const figuresOf = (
  catalog: EmailCatalog,
  locale: Locale,
  engagement: Option.Option<DigestEngagement>
): readonly string[] =>
  Option.match(engagement, {
    onNone: () => [],
    onSome: (counted) => {
      const number = new Intl.NumberFormat(locale);

      return [
        fill(
          catalog.weeklyDigest.engagement,
          new Map([["engagement", number.format(counted.engagement)]])
        ),
        ...Option.toArray(counted.impressions).map((impressions) =>
          fill(
            catalog.weeklyDigest.impressions,
            new Map([["impressions", number.format(impressions)]])
          )
        ),
      ];
    },
  });

const postLine = (catalog: EmailCatalog, locale: Locale, post: DigestPost) =>
  `${instantIn(post.at, locale)}: ${
    post.excerpt === "" ? catalog.weeklyDigest.noText : post.excerpt
  }`;

// The posts listed, a line each, then how many more were counted. None
// listed, nothing said.
const linesOf = (
  catalog: EmailCatalog,
  locale: Locale,
  posts: readonly DigestPost[],
  counted: number
): readonly string[] =>
  posts.length === 0
    ? []
    : [
        ...posts.map((post) => postLine(catalog, locale, post)),
        ...(counted > posts.length
          ? [
              pluralIn(
                locale,
                catalog.weeklyDigest.more,
                counted - posts.length
              ),
            ]
          : []),
      ];

const partOf = (
  catalog: EmailCatalog,
  locale: Locale,
  workspace: LinkedDigestWorkspace
): DigestPart => ({
  calendar: fill(
    catalog.weeklyDigest.calendar,
    new Map([
      [
        "workspaceName",
        nameForMail(workspace.name, catalog.withheldNames.workspace),
      ],
    ])
  ),
  calendarUrl: workspace.calendarUrl,
  counts: countsOf(catalog, locale, workspace.counts),
  figures: figuresOf(catalog, locale, workspace.engagement),
  name: nameForMail(workspace.name, catalog.withheldNames.workspace),
  planned: linesOf(
    catalog,
    locale,
    workspace.planned,
    workspace.counts.scheduled + workspace.counts.awaitingApproval
  ),
  wentOut: linesOf(
    catalog,
    locale,
    workspace.wentOut,
    workspace.counts.wentOut
  ),
});

/** What a digest says, in its reader's language, as plain text. */
export interface DigestContent {
  readonly action: string;
  readonly intro: string;
  readonly parts: readonly DigestPart[];
  readonly plannedHeading: string;
  /** The words that link to the preferences. */
  readonly preferences: string;
  readonly preferencesUrl: string;
  readonly subject: string;
  readonly url: string;
  readonly wentOutHeading: string;
  /** Why it comes and how to stop it, around `preferences`. */
  readonly why: { readonly after: string; readonly before: string };
}

const preferencesPlace = "{preferences}";

/** A digest's content, in its reader's language. */
export const digestContent = (email: WeeklyDigestEmail): DigestContent => {
  const catalog = catalogs[email.locale];
  const words = catalog.weeklyDigest;

  const range = new Map([
    ["from", dayIn(email.week.from, email.locale)],
    ["to", dayIn(lastDayBefore(email.week.to), email.locale)],
    ["until", dayIn(lastDayBefore(email.week.until), email.locale)],
  ]);

  const [before = "", after = ""] = words.ignore.split(preferencesPlace);

  return {
    action: words.action,
    intro: fill(words.intro, range),
    parts: email.workspaces.map((workspace) =>
      partOf(catalog, email.locale, workspace)
    ),
    plannedHeading: words.plannedHeading,
    preferences: words.preferences,
    preferencesUrl: email.preferencesUrl,
    subject: fill(words.subject, range),
    url: email.calendarUrl,
    wentOutHeading: words.wentOutHeading,
    why: { after, before },
  };
};

const listText = (
  heading: string,
  lines: readonly string[]
): readonly string[] =>
  lines.length === 0
    ? []
    : [`${heading}:`, ...lines.map((line) => `- ${line}`)];

const partText = (content: DigestContent, part: DigestPart): string =>
  [
    part.name,
    part.counts,
    ...part.figures,
    ...listText(content.wentOutHeading, part.wentOut),
    ...listText(content.plannedHeading, part.planned),
    `${part.calendar}: ${part.calendarUrl}`,
  ].join("\n");

/** A digest's text. */
export const digestText = (content: DigestContent, locale: Locale): string =>
  textPart(
    {
      action: content.action,
      blocks: [
        content.intro,
        ...content.parts.map((part) => partText(content, part)),
      ],
      ignore: `${content.why.before}${content.preferences} (${content.preferencesUrl})${content.why.after}`,
      url: content.url,
    },
    locale
  );
