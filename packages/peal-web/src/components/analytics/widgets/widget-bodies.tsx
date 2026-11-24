"use client";

import { DateTime } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type {
  AnalyticsDashboard,
  DashboardTotals,
  ExportKind,
  Platform,
  SocialChannel,
} from "peal-contract";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "peal-ui/components/chart";
import type { ChartConfig } from "peal-ui/components/chart";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "peal-ui/components/table";
import { useId } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { dayDate } from "#analytics/report.ts";
import { sumOf } from "#analytics/widgets.ts";
import type {
  FigureDay,
  Figures,
  WidgetHeight,
  WidgetWidth,
} from "#analytics/widgets.ts";
import { channelName } from "#channels/channel-name.ts";
import { useTrendWords } from "#components/analytics/use-trend-words.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";

import { Headline } from "./widget-card.tsx";

// The files the export widget offers, in its order.
const exportKinds: readonly ExportKind[] = ["posts", "accounts"];

/** The counts a widget draws day by day. */
export type DayCount = "engagement" | "followers" | "reach" | "views";

/** The totals a stat widget shows, with each platform's beside. */
export type StatCount = "clicks" | "impressions" | "saves";

/** How much room a widget has: the columns and rows it spans. */
interface Room {
  readonly height: WidgetHeight;
  readonly width: WidgetWidth;
}

const brand = "var(--chart-1)";

// The platforms' colours in a breakdown, in the theme's chart palette.
const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const colourAt = (index: number): string =>
  palette[index % palette.length] ?? brand;

/** A calendar day, short ("Nov 24"), as the calendar has it. */
const useDayLabel = () => {
  const format = useFormatter();

  return (day: string | number | undefined) =>
    format.dateTime(dayDate(String(day)), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
};

/**
 * The days a chart names under it: the first and the last, and more
 * between them as the widget widens, evenly spread.
 */
const DayTicks = ({
  days,
  width,
}: {
  readonly days: readonly FigureDay[];
  readonly width: WidgetWidth;
}) => {
  const dayLabel = useDayLabel();
  const wanted = Math.min(days.length, width === 1 ? 3 : width * 2 + 1);

  const shown =
    wanted < 2
      ? days.slice(0, 1)
      : Array.from(
          { length: wanted },
          (_, index) =>
            days[Math.round((index * (days.length - 1)) / (wanted - 1))]
        ).filter((day) => day !== undefined);

  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground flex justify-between text-xs tabular-nums"
    >
      {shown.map((day) => (
        <span key={day.date}>{dayLabel(day.date)}</span>
      ))}
    </div>
  );
};

/** A chart's figures as a table, for screen readers alone. */
const DaysTable = ({
  count,
  days,
  name,
}: {
  readonly count: DayCount;
  readonly days: readonly FigureDay[];
  readonly name: string;
}) => {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const dayLabel = useDayLabel();

  return (
    <Table className="sr-only">
      <TableCaption>{t("widgets.daysCaption", { name })}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t("chart.day")}</TableHead>
          <TableHead scope="col">{t("metric", { metric: count })}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {days.map((day) => (
          <TableRow key={day.date}>
            <TableHead scope="row">{dayLabel(day.date)}</TableHead>
            <TableCell variant="numeric">
              {day[count] === null
                ? t("totals.notGiven")
                : format.number(day[count])}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

/**
 * One count over the days as a line on a faint area, bleeding to the
 * card's edges, with the day and the count where the pointer rests.
 * Screen readers take its table.
 */
export const Sparkline = ({
  count,
  days,
  name,
  room,
}: {
  readonly count: DayCount;
  readonly days: readonly FigureDay[];
  readonly name: string;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const dayLabel = useDayLabel();
  const gradient = `spark-${useId().replaceAll(/[^a-zA-Z0-9]/gu, "")}`;

  const config: ChartConfig = {
    [count]: { color: brand, label: t("metric", { metric: count }) },
  };

  return (
    <figure className="flex min-h-0 flex-1 flex-col gap-2">
      <ChartContainer
        aria-hidden="true"
        config={config}
        className="-mx-6 aspect-auto min-h-16 flex-1"
      >
        <AreaChart
          accessibilityLayer={false}
          data={[...days]}
          margin={{ bottom: 2, left: 0, right: 0, top: 8 }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={brand} stopOpacity={0.2} />
              <stop offset="100%" stopColor={brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis
            domain={
              count === "followers" ? ["dataMin", "dataMax"] : [0, "auto"]
            }
            hide
          />
          <ChartTooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                formatLabel={dayLabel}
                formatValue={(value) => format.number(value)}
              />
            }
          />
          <Area
            activeDot={{
              fill: brand,
              r: 4,
              stroke: "var(--card)",
              strokeWidth: 2,
            }}
            connectNulls
            dataKey={count}
            dot={false}
            fill={`url(#${gradient})`}
            isAnimationActive={false}
            stroke={brand}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
      <DayTicks days={days} width={room.width} />
      <figcaption>
        <DaysTable count={count} days={days} name={name} />
      </figcaption>
    </figure>
  );
};

/**
 * Each day's count as a thin column, the one under the pointer in full
 * blue: for a count a day stands on its own, as views.
 */
const DayColumns = ({
  count,
  days,
  name,
  room,
}: {
  readonly count: DayCount;
  readonly days: readonly FigureDay[];
  readonly name: string;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const dayLabel = useDayLabel();

  const config: ChartConfig = {
    [count]: { color: brand, label: t("metric", { metric: count }) },
  };

  return (
    <figure className="flex min-h-0 flex-1 flex-col gap-2">
      <ChartContainer
        aria-hidden="true"
        config={config}
        className="aspect-auto min-h-16 flex-1"
      >
        <BarChart
          accessibilityLayer={false}
          barCategoryGap="20%"
          data={[...days]}
          margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
        >
          <XAxis dataKey="date" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatLabel={dayLabel}
                formatValue={(value) => format.number(value)}
              />
            }
          />
          <Bar
            activeBar={{ fill: brand, fillOpacity: 1 }}
            dataKey={count}
            fill={brand}
            fillOpacity={0.35}
            isAnimationActive={false}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
      <DayTicks days={days} width={room.width} />
      <figcaption>
        <DaysTable count={count} days={days} name={name} />
      </figcaption>
    </figure>
  );
};

/**
 * A count over the days: followers at the end and what they gained, the
 * engagement and the reach with their change against the days before,
 * or the accounts' views added up; then the days, as a line or, for
 * views, as columns.
 */
export const DayCountBody = ({
  count,
  figures,
  name,
  room,
}: {
  readonly count: DayCount;
  readonly figures: Figures;
  readonly name: string;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics.widgets");
  const words = useTrendWords();
  const read = figures.days.some((day) => day[count] !== null);

  const headline = (() => {
    switch (count) {
      case "followers": {
        return (
          <Headline
            value={figures.followers.current}
            hint={words.gained(figures.followers.gained, "current")}
          />
        );
      }

      case "engagement":
      case "reach": {
        return (
          <Headline
            value={figures.totals[count]}
            hint={words.trend(
              figures.totals[count],
              figures.previousTotals[count],
              figures.previousKept
            )}
          />
        );
      }

      case "views": {
        return (
          <Headline
            value={sumOf(figures.days, "views")}
            hint={t("overDays", { days: figures.days.length })}
          />
        );
      }

      default: {
        return count satisfies never;
      }
    }
  })();

  if (!read) {
    return (
      <>
        {headline}
        <p className="text-muted-foreground mt-auto text-sm">{t("noDays")}</p>
      </>
    );
  }

  return (
    <>
      {headline}
      {count === "views" ? (
        <DayColumns count={count} days={figures.days} name={name} room={room} />
      ) : (
        <Sparkline count={count} days={figures.days} name={name} room={room} />
      )}
    </>
  );
};

/** Each platform's share of a total, largest first. */
const sharesOf = (
  figures: Figures,
  count: keyof DashboardTotals
): readonly { readonly given: number; readonly platform: Platform }[] =>
  figures.platforms
    .flatMap(({ platform, totals }) => {
      const given = totals[count];

      return given === null || given === 0 ? [] : [{ given, platform }];
    })
    .toSorted((one, other) => other.given - one.given);

/**
 * A total of the range's posts with its trend, then the platforms that
 * gave it, each a bar as long as its share.
 */
export const StatBody = ({
  count,
  figures,
  room,
}: {
  readonly count: StatCount;
  readonly figures: Figures;
  readonly room: Room;
}) => {
  const tPosts = useTranslations("Posts");
  const words = useTrendWords();
  const format = useFormatter();
  const value = figures.totals[count];
  const shares = sharesOf(figures, count).slice(0, room.height === 2 ? 8 : 4);
  const most = Math.max(1, ...shares.map(({ given }) => given));

  return (
    <>
      <Headline
        value={value}
        hint={
          value === null
            ? undefined
            : words.trend(
                value,
                figures.previousTotals[count],
                figures.previousKept
              )
        }
      />
      {shares.length === 0 ? null : (
        <ul className="mt-auto flex flex-col gap-2.5">
          {shares.map(({ given, platform }) => (
            <li key={platform} className="flex flex-col gap-1 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {tPosts("platform", { platform })}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {format.number(given)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="bg-muted h-1 overflow-hidden rounded-full"
              >
                <span
                  className="bg-brand block h-full w-(--share) rounded-full"
                  style={{ "--share": `${String((given / most) * 100)}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

/**
 * The posts that went out, as a ring of the platforms they went out on,
 * the total in its middle, and each platform's count beside it.
 */
export const PostsRingBody = ({
  figures,
  room,
}: {
  readonly figures: Figures;
  readonly room: Room;
}) => {
  const tPosts = useTranslations("Posts");
  const words = useTrendWords();
  const format = useFormatter();
  const shares = sharesOf(figures, "posts");
  const total = figures.totals.posts;

  const config: ChartConfig = Object.fromEntries(
    shares.map(({ platform }, index) => [
      platform,
      { color: colourAt(index), label: tPosts("platform", { platform }) },
    ])
  );

  const wide = room.width > 1;

  if (shares.length === 0) {
    return <Headline value={total} />;
  }

  return (
    <div
      data-wide={wide || undefined}
      className="flex min-h-0 flex-1 flex-col gap-3 data-[wide]:flex-row data-[wide]:items-center data-[wide]:gap-6"
    >
      <figure className="relative mx-auto aspect-square min-h-0 w-full max-w-36 flex-1 data-[wide]:flex-none">
        <ChartContainer
          aria-hidden="true"
          config={config}
          className="aspect-square h-full max-h-full"
        >
          <PieChart accessibilityLayer={false}>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatValue={(value) => format.number(value)}
                />
              }
            />
            <Pie
              data={shares.map(({ given, platform }, index) => ({
                fill: colourAt(index),
                platform,
                value: given,
              }))}
              dataKey="value"
              innerRadius="80%"
              isAnimationActive={false}
              nameKey="platform"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            />
          </PieChart>
        </ChartContainer>
        <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tracking-tight tabular-nums">
            {format.number(total)}
          </span>
        </figcaption>
      </figure>
      <div
        data-wide={wide || undefined}
        className="flex flex-col items-center gap-2 data-[wide]:flex-1 data-[wide]:items-stretch"
      >
        <p className="text-muted-foreground text-xs">
          {words.trend(
            total,
            figures.previousTotals.posts,
            figures.previousKept
          )}
        </p>
        <ul
          data-wide={wide || undefined}
          className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs data-[wide]:flex-col data-[wide]:flex-nowrap data-[wide]:gap-1.5 data-[wide]:text-sm"
        >
          {shares
            .slice(0, room.height === 2 ? 8 : 4)
            .map(({ given, platform }, index) => (
              <li key={platform} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-(--swatch)"
                  style={{ "--swatch": colourAt(index) }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {tPosts("platform", { platform })}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {format.number(given)}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
};

// A day of engagement as the chart draws it: its parts, and the average
// of the seven days up to it.
interface ActivityDay {
  readonly average: number;
  readonly date: string;
  readonly likes: number;
  readonly quotes: number;
  readonly replies: number;
  readonly reposts: number;
}

const activityOf = (days: readonly FigureDay[]): readonly ActivityDay[] =>
  days.map((day, index) => {
    const week = days.slice(Math.max(0, index - 6), index + 1);

    return {
      average:
        week.reduce((sum, each) => sum + each.engagement, 0) / week.length,
      date: day.date,
      likes: day.likes,
      quotes: day.quotes,
      replies: day.replies,
      reposts: day.reposts,
    };
  });

// The parts of a day's engagement, one blue from deep to faint.
const parts = [
  ["likes", 1, "bg-brand"],
  ["reposts", 0.7, "bg-brand/70"],
  ["replies", 0.45, "bg-brand/45"],
  ["quotes", 0.25, "bg-brand/25"],
] as const;

/**
 * What the posts gained each day: a column per day in one blue, its
 * parts from deep (likes) to faint (quotes), and the seven-day average
 * as a line over them, which shows the trend through a week's ups and
 * downs. The pointer gives a day's parts.
 */
export const ActivityBody = ({
  figures,
  name,
  room,
}: {
  readonly figures: Figures;
  readonly name: string;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics");
  const words = useTrendWords();
  const format = useFormatter();
  const dayLabel = useDayLabel();

  const shown = parts.filter(
    ([part]) => part !== "quotes" || figures.totals.quotes !== null
  );

  const config: ChartConfig = {
    average: { color: "var(--foreground)", label: t("widgets.average") },
    ...Object.fromEntries(
      shown.map(([part, opacity]) => [
        part,
        {
          color: `color-mix(in oklab, ${brand} ${String(opacity * 100)}%, transparent)`,
          label: t("metric", { metric: part }),
        },
      ])
    ),
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Headline
          value={figures.totals.engagement}
          hint={words.trend(
            figures.totals.engagement,
            figures.previousTotals.engagement,
            figures.previousKept
          )}
        />
        <ul
          aria-hidden="true"
          className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs"
        >
          {shown.map(([part, , swatch]) => (
            <li key={part} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-xs ${swatch}`} />
              {t("metric", { metric: part })}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="bg-foreground h-0.5 w-3 rounded-full" />
            {t("widgets.average")}
          </li>
        </ul>
      </div>
      <figure className="flex min-h-0 flex-1 flex-col gap-2">
        <ChartContainer
          aria-hidden="true"
          config={config}
          className="aspect-auto min-h-24 flex-1"
        >
          <ComposedChart
            accessibilityLayer={false}
            barCategoryGap="18%"
            data={[...activityOf(figures.days)]}
            margin={{ bottom: 0, left: 0, right: 0, top: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" hide />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              orientation="right"
              tickCount={room.height === 2 ? 5 : 3}
              tickFormatter={(value: number) =>
                format.number(value, { notation: "compact" })
              }
              tickLine={false}
              width={40}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", radius: 4 }}
              content={
                <ChartTooltipContent
                  formatLabel={dayLabel}
                  formatValue={(value) =>
                    format.number(value, { maximumFractionDigits: 0 })
                  }
                />
              }
            />
            {shown.map(([part, opacity], index) => (
              <Bar
                key={part}
                dataKey={part}
                fill={brand}
                fillOpacity={opacity}
                isAnimationActive={false}
                radius={index === shown.length - 1 ? [3, 3, 0, 0] : 0}
                stackId="day"
              />
            ))}
            <Line
              dataKey="average"
              dot={false}
              isAnimationActive={false}
              stroke="var(--foreground)"
              strokeWidth={1.5}
              type="monotone"
            />
          </ComposedChart>
        </ChartContainer>
        <DayTicks days={figures.days} width={room.width} />
        <figcaption>
          <DaysTable count="engagement" days={figures.days} name={name} />
        </figcaption>
      </figure>
    </>
  );
};

const compared = ["posts", "engagement", "impressions", "reach"] as const;

/** The range's totals beside the range before, four tiles. */
export const ComparisonBody = ({
  figures,
  room,
}: {
  readonly figures: Figures;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics");
  const words = useTrendWords();

  return (
    <dl
      data-wide={room.width > 2 || undefined}
      className="my-auto grid grid-cols-2 gap-3 data-[wide]:grid-cols-4"
    >
      {compared.map((metric) => (
        <div
          key={metric}
          className="flex flex-col gap-1 rounded-lg border px-4 py-3"
        >
          <dt className="text-muted-foreground text-sm">
            {t("metric", { metric })}
          </dt>
          <dd className="flex flex-col gap-1">
            {figures.totals[metric] === null ? (
              <span className="text-muted-foreground text-sm">
                {t("totals.notGiven")}
              </span>
            ) : (
              <>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {words.count(figures.totals[metric])}
                </span>
                <span className="text-muted-foreground text-sm">
                  {words.trend(
                    figures.totals[metric],
                    figures.previousTotals[metric],
                    figures.previousKept
                  )}
                </span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};

/** What makes a link to a post's page, which the page passes in. */
export interface PostLinkProps {
  readonly children: ReactNode;
  readonly postId: string;
  readonly workspaceId: string;
}

/**
 * The posts people did the most with, one quiet line each: the
 * platform's mark, the start of the post (or its channel, until the text
 * is read) with its day under it, and its engagement at the end. As many as the widget has room for.
 * `PostLink` links a line to the post's page, `Excerpt` gives the start
 * of its text once it is read.
 */
export const TopPostsBody = ({
  channels,
  dashboard,
  Excerpt,
  PostLink,
  room,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly dashboard: AnalyticsDashboard;
  readonly Excerpt: ComponentType<{
    readonly fallback: string;
    readonly postId: string;
    readonly workspaceId: string;
  }>;
  readonly PostLink: ComponentType<PostLinkProps>;
  readonly room: Room;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics");
  const format = useFormatter();

  if (dashboard.topPosts.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("top.empty")}</p>;
  }

  return (
    <ol className="-mx-2 flex flex-col">
      {dashboard.topPosts.slice(0, room.height === 2 ? 10 : 4).map((post) => {
        const channel = channels.find(({ id }) => id === post.channelId);

        const where =
          channel === undefined
            ? t("widgets.channelGone")
            : channelName(channel);

        return (
          <li key={post.targetId}>
            <PostLink postId={post.postId} workspaceId={workspaceId}>
              <span className="hover:bg-muted flex items-center gap-3 rounded-md px-2 py-2">
                {channel === undefined ? (
                  <span className="bg-muted size-5 shrink-0 rounded-sm" />
                ) : (
                  <PlatformMark platform={channel.platform} />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm" dir="auto">
                    <Excerpt
                      fallback={where}
                      postId={post.postId}
                      workspaceId={workspaceId}
                    />
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {format.dateTime(DateTime.toDate(post.publishedAt), {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {format.number(post.engagement)}
                </span>
              </span>
            </PostLink>
          </li>
        );
      })}
    </ol>
  );
};

/**
 * Each channel on a line: its platform's mark, its name, and its
 * followers with what they gained over the range.
 */
export const ChannelsBody = ({
  channels,
  dashboard,
  room,
}: {
  readonly channels: readonly SocialChannel[];
  readonly dashboard: AnalyticsDashboard;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics");
  const words = useTrendWords();
  const format = useFormatter();

  if (dashboard.channels.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("widgets.noDays")}</p>
    );
  }

  const ranked = dashboard.channels.toSorted(
    (one, other) =>
      (other.followers.current ?? -1) - (one.followers.current ?? -1)
  );

  return (
    <ul aria-label={t("totals.caption")} className="flex flex-col">
      {ranked.slice(0, room.height === 2 ? 10 : 4).map((numbers) => {
        const channel = channels.find(({ id }) => id === numbers.channelId);
        const { gained } = numbers.followers;

        return (
          <li
            key={numbers.channelId}
            className="flex items-center gap-3 border-b py-2 last:border-b-0"
          >
            {channel === undefined ? (
              <span className="bg-muted size-5 shrink-0 rounded-sm" />
            ) : (
              <PlatformMark platform={channel.platform} />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">
              {channel === undefined
                ? t("widgets.channelGone")
                : channelName(channel)}
            </span>
            <span className="flex flex-col items-end">
              <span className="text-sm font-medium tabular-nums">
                {words.count(numbers.followers.current)}
              </span>
              {gained === null || gained === 0 ? null : (
                <span className="text-muted-foreground text-xs tabular-nums">
                  {format.number(gained, { signDisplay: "always" })}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

/**
 * Where the engagement came from: one bar cut into each platform's
 * share, then each platform with its share and its engagement.
 */
export const PlatformsBody = ({
  dashboard,
  room,
}: {
  readonly dashboard: AnalyticsDashboard;
  readonly room: Room;
}) => {
  const t = useTranslations("Analytics");
  const tPosts = useTranslations("Posts");
  const format = useFormatter();

  const ranked = dashboard.platforms
    .map(({ platform, totals }) => ({ given: totals.engagement, platform }))
    .filter(({ given }) => given > 0)
    .toSorted((one, other) => other.given - one.given);

  const total = ranked.reduce((sum, { given }) => sum + given, 0);

  if (ranked.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("widgets.noDays")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {t("widgets.engagementShare")}
      </p>
      <div
        aria-hidden="true"
        className="flex h-2 gap-0.5 overflow-hidden rounded-full"
      >
        {ranked.map(({ given, platform }, index) => (
          <span
            key={platform}
            className="h-full w-(--share) bg-(--swatch) first:rounded-l-full last:rounded-r-full"
            style={{
              "--share": `${String((given / total) * 100)}%`,
              "--swatch": colourAt(index),
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {ranked
          .slice(0, room.height === 2 ? 10 : 4)
          .map(({ given, platform }, index) => (
            <li key={platform} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-(--swatch)"
                style={{ "--swatch": colourAt(index) }}
              />
              <span className="flex-1 truncate">
                {tPosts("platform", { platform })}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {format.number(given / total, {
                  maximumFractionDigits: 0,
                  style: "percent",
                })}
              </span>
              <span className="w-16 text-right font-medium tabular-nums">
                {format.number(given)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
};

/**
 * The exports of the range, as files: each button saves one
 * (`downloadExport`), as a link could not name the workspace.
 */
export const ExportBody = ({
  busy = false,
  onDownload,
}: {
  readonly busy?: boolean;
  readonly onDownload: (kind: ExportKind) => void;
}) => {
  const t = useTranslations("Analytics.export");

  return (
    <div className="mt-auto flex flex-col items-start gap-2">
      <p className="text-muted-foreground text-sm">{t("description")}</p>
      {exportKinds.map((kind) => (
        <button
          key={kind}
          type="button"
          disabled={busy}
          onClick={() => {
            onDownload(kind);
          }}
          className="text-left text-sm font-medium underline-offset-4 hover:underline disabled:opacity-50"
        >
          {t(kind)}
        </button>
      ))}
    </div>
  );
};
