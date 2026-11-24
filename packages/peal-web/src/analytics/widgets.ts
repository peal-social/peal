import { Option, Schema } from "effect";
import type {
  AnalyticsDashboard,
  ChannelSeries,
  DashboardTotals,
  FollowerChange,
  Platform,
} from "peal-contract";

import { addDays, dateKey } from "#posts/zoned-time.ts";
import type { CalendarDate } from "#posts/zoned-time.ts";

import type { SummaryRange } from "./api.ts";

// The analytics page is a board of widgets (DESIGN.md, "Analytics"): each
// one a card of a kind, with a period and, where its kind has one, a
// channel of its own. The board is the person's, kept in their browser
// for each workspace.

/** The kinds of widget, each a card that shows one thing. */
export const widgetKinds = [
  "followers",
  "engagement",
  "views",
  "posts",
  "impressions",
  "reach",
  "clicks",
  "saves",
  "activity",
  "comparison",
  "topPosts",
  "channels",
  "platforms",
  "bestTimes",
  "export",
] as const;

export const WidgetKindSchema = Schema.Literals(widgetKinds);

export type WidgetKind = typeof WidgetKindSchema.Type;

/**
 * How much of the board's row a widget takes: a quarter, a half, or all
 * of it, on a wide screen; the whole row on a phone.
 */
export type WidgetSize = "small" | "medium" | "wide";

/** The spans of days a widget may show. */
export const PeriodSchema = Schema.Literals([
  "7",
  "30",
  "90",
  "180",
  "365",
  "month",
  "quarter",
  "year",
]);

export type Period = typeof PeriodSchema.Type;

/** The periods of every widget but best times, in the menu's order. */
export const reportPeriods: readonly Period[] = [
  "month",
  "quarter",
  "year",
  "7",
  "30",
  "90",
  "365",
];

/** Best times reads 30, 90 or 180 days back, as the API takes them. */
export const bestTimesPeriods: readonly Period[] = ["30", "90", "180"];

/** The sections of the panel that adds widgets. */
export type WidgetSection = "suggested" | "audience" | "posts" | "files";

interface KindDescription {
  /** Whether the widget may show one channel instead of all of them. */
  readonly channel: "optional" | "required" | "none";
  readonly period: Period;
  readonly periods: readonly Period[];
  readonly sections: readonly WidgetSection[];
  readonly size: WidgetSize;
}

const report = (
  size: WidgetSize,
  channel: KindDescription["channel"],
  sections: readonly WidgetSection[]
): KindDescription => ({
  channel,
  period: "30",
  periods: reportPeriods,
  sections,
  size,
});

/** What each kind of widget is: its size, its filters, where it is offered. */
export const kinds: Readonly<Record<WidgetKind, KindDescription>> = {
  activity: report("wide", "optional", ["suggested", "posts"]),
  bestTimes: {
    channel: "required",
    period: "90",
    periods: bestTimesPeriods,
    sections: ["posts"],
    size: "medium",
  },
  channels: report("medium", "none", ["audience"]),
  clicks: report("small", "optional", ["posts"]),
  comparison: report("wide", "none", ["suggested", "posts"]),
  engagement: report("small", "optional", ["suggested", "posts"]),
  export: report("small", "none", ["files"]),
  followers: report("small", "optional", ["suggested", "audience"]),
  impressions: report("small", "optional", ["posts"]),
  platforms: report("medium", "none", ["audience"]),
  posts: report("small", "optional", ["posts"]),
  reach: report("small", "optional", ["posts"]),
  saves: report("small", "optional", ["posts"]),
  topPosts: report("medium", "none", ["suggested", "posts"]),
  views: report("small", "optional", ["audience"]),
};

/** One widget on the board. */
export const WidgetSchema = Schema.Struct({
  /** One channel's numbers instead of the workspace's, where it may. */
  channelId: Schema.optionalKey(Schema.String),
  id: Schema.String,
  kind: WidgetKindSchema,
  period: Schema.optionalKey(PeriodSchema),
  /** The name the person gave it, instead of its kind's. */
  title: Schema.optionalKey(Schema.String),
});

export type Widget = typeof WidgetSchema.Type;

/** The board: its widgets, in order. */
export const BoardSchema = Schema.Struct({
  version: Schema.Literal(1),
  widgets: Schema.Array(WidgetSchema),
});

export type Board = typeof BoardSchema.Type;

/** The longest name a widget may be given. */
export const maxTitleLength = 60;

/** The board a workspace's page starts with, and goes back to on reset. */
export const defaultBoard: Board = {
  version: 1,
  widgets: [
    { id: "followers", kind: "followers" },
    { id: "top-posts", kind: "topPosts" },
    { id: "engagement", kind: "engagement" },
    { id: "activity", kind: "activity" },
    { id: "posts", kind: "posts" },
    { id: "impressions", kind: "impressions" },
    { id: "channels", kind: "channels" },
    { id: "comparison", kind: "comparison" },
    { id: "best-times", kind: "bestTimes" },
    { id: "views", kind: "views" },
    { id: "export", kind: "export" },
  ],
};

const decodeBoard = Schema.decodeUnknownOption(
  Schema.fromJsonString(BoardSchema)
);

/**
 * The board kept as `stored`: the default when nothing is kept, or what is
 * kept no longer reads (an older shape, a hand-edited value).
 */
export const boardFrom = (stored: string | null): Board =>
  stored === null
    ? defaultBoard
    : decodeBoard(stored).pipe(Option.getOrElse(() => defaultBoard));

/** The board as it is kept. */
export const boardText = (board: Board): string => JSON.stringify(board);

/** Where the board of a workspace is kept, in the browser. */
export const boardKey = (workspaceId: string): string =>
  `peal.analytics.board.${workspaceId}`;

/** The period a widget shows: its own, or its kind's when it has none. */
export const periodOf = (widget: Widget): Period => {
  const kind = kinds[widget.kind];

  return widget.period !== undefined && kind.periods.includes(widget.period)
    ? widget.period
    : kind.period;
};

/**
 * The channel a widget shows: its own while the workspace still has it;
 * otherwise none, or the first channel for a kind that needs one.
 */
export const channelOf = (
  widget: Widget,
  channelIds: readonly string[]
): string | null => {
  const { channel } = kinds[widget.kind];

  if (channel === "none") {
    return null;
  }

  if (widget.channelId !== undefined && channelIds.includes(widget.channelId)) {
    return widget.channelId;
  }

  return channel === "required" ? (channelIds[0] ?? null) : null;
};

// The changes a board takes. Each answers a new board, the one given
// untouched.

const replace = (
  board: Board,
  id: string,
  change: (widget: Widget) => Widget
): Board => ({
  ...board,
  widgets: board.widgets.map((widget) =>
    widget.id === id ? change(widget) : widget
  ),
});

/** The board with a widget of `kind` added at its end. */
export const addWidget = (
  board: Board,
  kind: WidgetKind,
  id: string
): Board => ({
  ...board,
  widgets: [...board.widgets, { id, kind }],
});

/** The board without the widget. */
export const removeWidget = (board: Board, id: string): Board => ({
  ...board,
  widgets: board.widgets.filter((widget) => widget.id !== id),
});

/** The board with a copy of the widget right after it, filters and all. */
export const duplicateWidget = (
  board: Board,
  id: string,
  copyId: string
): Board => ({
  ...board,
  widgets: board.widgets.flatMap((widget) =>
    widget.id === id ? [widget, { ...widget, id: copyId }] : [widget]
  ),
});

/**
 * The board with the widget named `title`, cut to `maxTitleLength`; an
 * empty name gives it back its kind's.
 */
export const renameWidget = (
  board: Board,
  id: string,
  title: string
): Board => {
  const name = title.trim().slice(0, maxTitleLength);

  return replace(board, id, ({ title: _, ...widget }) =>
    name === "" ? widget : { ...widget, title: name }
  );
};

/** The board with the widget showing `period`, left out when its kind's. */
export const setPeriod = (board: Board, id: string, period: Period): Board =>
  replace(board, id, ({ period: _, ...widget }) =>
    period === kinds[widget.kind].period ? widget : { ...widget, period }
  );

/** The board with the widget showing one channel, or all with null. */
export const setChannel = (
  board: Board,
  id: string,
  channelId: string | null
): Board =>
  replace(board, id, ({ channelId: _, ...widget }) =>
    channelId === null ? widget : { ...widget, channelId }
  );

/**
 * The board with the widget moved to `index` among the others: dropped
 * there, or one place earlier or later from its menu.
 */
export const moveWidget = (board: Board, id: string, index: number): Board => {
  const moved = board.widgets.find((widget) => widget.id === id);

  if (moved === undefined) {
    return board;
  }

  const others = board.widgets.filter((widget) => widget.id !== id);
  const at = Math.max(0, Math.min(index, others.length));

  return {
    ...board,
    widgets: [...others.slice(0, at), moved, ...others.slice(at)],
  };
};

// Days, as the server takes a range.

const startOfQuarter = (today: CalendarDate): CalendarDate => ({
  day: 1,
  month: Math.floor((today.month - 1) / 3) * 3 + 1,
  year: today.year,
});

/**
 * The days a period covers up to `today`, both included: the last 7, 30,
 * 90, 180 or 365 days, or this month, quarter or year so far.
 */
export const periodRange = (
  period: Period,
  today: CalendarDate,
  timeZone: string
): SummaryRange => {
  const from = (() => {
    switch (period) {
      case "month": {
        return { ...today, day: 1 };
      }

      case "quarter": {
        return startOfQuarter(today);
      }

      case "year": {
        return { day: 1, month: 1, year: today.year };
      }

      case "7":
      case "30":
      case "90":
      case "180":
      case "365": {
        return addDays(today, 1 - Number(period));
      }

      default: {
        return period satisfies never;
      }
    }
  })();

  return { from: dateKey(from), timeZone, to: dateKey(today) };
};

/** A period's length in days, as best times asks for it. */
export const bestTimesDays = (period: Period): 30 | 90 | 180 => {
  if (period === "30") {
    return 30;
  }

  return period === "180" ? 180 : 90;
};

// What a widget reads: the workspace's numbers, or one channel's.

/** One day of the numbers a widget draws. */
export interface FigureDay {
  readonly date: string;
  readonly engagement: number;
  readonly followers: number | null;
  readonly likes: number;
  readonly quotes: number;
  readonly reach: number | null;
  readonly replies: number;
  readonly reposts: number;
  readonly views: number | null;
}

/** What a widget shows, for the workspace or for one of its channels. */
export interface Figures {
  readonly days: readonly FigureDay[];
  readonly followers: FollowerChange;
  /** Each platform's totals, those of the channel's alone for a channel. */
  readonly platforms: readonly {
    readonly platform: Platform;
    readonly totals: DashboardTotals;
  }[];
  readonly previousFollowers: FollowerChange;
  readonly previousKept: boolean;
  readonly previousTotals: DashboardTotals;
  readonly totals: DashboardTotals;
}

const dayOf = (day: {
  readonly date: string;
  readonly followers: number | null;
  readonly likes: number;
  readonly quotes: number;
  readonly reach: number | null;
  readonly replies: number;
  readonly reposts: number;
  readonly views: number | null;
}): FigureDay => ({
  date: day.date,
  engagement: day.likes + day.reposts + day.replies + day.quotes,
  followers: day.followers,
  likes: day.likes,
  quotes: day.quotes,
  reach: day.reach,
  replies: day.replies,
  reposts: day.reposts,
  views: day.views,
});

/** The workspace's numbers over the dashboard's range. */
export const workspaceFigures = (dashboard: AnalyticsDashboard): Figures => ({
  days: dashboard.days.map(dayOf),
  followers: dashboard.followers,
  platforms: dashboard.platforms.map(({ platform, totals }) => ({
    platform,
    totals,
  })),
  previousFollowers: dashboard.previousFollowers,
  previousKept: dashboard.previousKept,
  previousTotals: dashboard.previousTotals,
  totals: dashboard.totals,
});

/**
 * One channel's numbers: its days from its series, its comparison from
 * the dashboard of the same range. None when the dashboard does not have
 * the channel.
 */
export const channelFigures = (
  dashboard: AnalyticsDashboard,
  series: ChannelSeries
): Option.Option<Figures> =>
  Option.fromUndefinedOr(
    dashboard.channels.find(({ channelId }) => channelId === series.channelId)
  ).pipe(
    Option.map((channel) => ({
      days: series.days.map(dayOf),
      followers: channel.followers,
      platforms:
        channel.platform === null
          ? []
          : [{ platform: channel.platform, totals: channel.totals }],
      previousFollowers: channel.previousFollowers,
      previousKept: channel.previousKept,
      previousTotals: channel.previousTotals,
      totals: channel.totals,
    }))
  );

/** The sum of a count over days, null when no day has it. */
export const sumOf = (
  days: readonly FigureDay[],
  count: "reach" | "views"
): number | null => {
  let sum: number | null = null;

  for (const day of days) {
    const value = day[count];

    if (value !== null) {
      sum = (sum ?? 0) + value;
    }
  }

  return sum;
};

/** Whether a widget's search words match its name or what it shows. */
export const matches = (
  query: string,
  ...texts: readonly string[]
): boolean => {
  const words = query.trim().toLocaleLowerCase().split(/\s+/u);
  const haystack = texts.join(" ").toLocaleLowerCase();

  return words.every((word) => haystack.includes(word));
};
