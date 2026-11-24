"use client";

import { DateTime } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import type {
  AnalyticsDashboard,
  DashboardTotals,
  SocialChannel,
} from "peal-contract";
import { ChartContainer } from "peal-ui/components/chart";
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
import type { ComponentType, ReactNode } from "react";
import { useId } from "react";
import { Area, AreaChart, YAxis } from "recharts";

import { dayDate } from "#analytics/report.ts";
import type { EngagementKey } from "#analytics/report.ts";
import { sumOf } from "#analytics/widgets.ts";
import type { FigureDay, Figures } from "#analytics/widgets.ts";
import { channelName } from "#channels/channel-name.ts";
import { EngagementChart } from "#components/analytics/engagement-chart.tsx";
import { useTrendWords } from "#components/analytics/use-trend-words.ts";

import { Headline } from "./widget-card.tsx";

/** The counts a small widget draws day by day. */
export type DayCount = "engagement" | "followers" | "views";

/** The totals a stat widget shows, with each platform's beside. */
export type StatCount = "clicks" | "impressions" | "posts" | "reach" | "saves";

const lineColor = "var(--chart-1)";

/**
 * One count over the days as a line on its area, with the first, middle
 * and last days under it, as Peal's numbers read at a glance. Screen
 * readers take the table, which the chart's figures are.
 */
export const Sparkline = ({
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
  const gradient = `spark-${useId().replaceAll(/[^a-zA-Z0-9]/gu, "")}`;

  const config: ChartConfig = {
    [count]: { color: lineColor, label: t("metric", { metric: count }) },
  };

  const dayLabel = (day: string) =>
    format.dateTime(dayDate(day), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  const first = days[0]?.date;
  const middle = days[Math.floor(days.length / 2)]?.date;
  const last = days.at(-1)?.date;

  return (
    <figure className="-mx-6 mt-auto flex flex-col gap-2">
      <ChartContainer
        aria-hidden="true"
        config={config}
        className="aspect-auto h-24 w-full"
      >
        <AreaChart
          accessibilityLayer={false}
          data={[...days]}
          margin={{ bottom: 0, left: 0, right: 0, top: 4 }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Area
            connectNulls
            dataKey={count}
            dot={false}
            fill={`url(#${gradient})`}
            isAnimationActive={false}
            stroke={lineColor}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ChartContainer>
      {first === undefined ||
      last === undefined ||
      middle === undefined ? null : (
        <div
          aria-hidden="true"
          className="text-muted-foreground flex justify-between px-6 text-xs tabular-nums"
        >
          <span>{dayLabel(first)}</span>
          <span>{dayLabel(middle)}</span>
          <span>{dayLabel(last)}</span>
        </div>
      )}
      <figcaption className="sr-only">
        <Table>
          <TableCaption>{t("widgets.daysCaption", { name })}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("chart.day")}</TableHead>
              <TableHead scope="col">
                {t("metric", { metric: count })}
              </TableHead>
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
      </figcaption>
    </figure>
  );
};

/**
 * A count over the days: followers at the end and what they gained, the
 * engagement and its trend, or the accounts' views added up; then its line.
 */
export const DayCountBody = ({
  count,
  figures,
  name,
}: {
  readonly count: DayCount;
  readonly figures: Figures;
  readonly name: string;
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

      case "engagement": {
        return (
          <Headline
            value={figures.totals.engagement}
            hint={words.trend(
              figures.totals.engagement,
              figures.previousTotals.engagement,
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

  return (
    <>
      {headline}
      {read ? (
        <Sparkline count={count} days={figures.days} name={name} />
      ) : (
        <p className="text-muted-foreground mt-auto text-sm">{t("noDays")}</p>
      )}
    </>
  );
};

/**
 * A total of the range's posts with its trend, then the platforms that
 * gave it, each with its share as a bar.
 */
export const StatBody = ({
  count,
  figures,
}: {
  readonly count: StatCount;
  readonly figures: Figures;
}) => {
  const tPosts = useTranslations("Posts");
  const words = useTrendWords();
  const format = useFormatter();
  const value = figures.totals[count];

  const shares = figures.platforms
    .flatMap(({ platform, totals }) => {
      const given = totals[count];

      return given === null || given === 0 ? [] : [{ given, platform }];
    })
    .toSorted((one, other) => other.given - one.given)
    .slice(0, 4);

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
        <ul className="mt-auto flex flex-col gap-2">
          {shares.map(({ given, platform }) => (
            <li key={platform} className="flex flex-col gap-1 text-sm">
              <span className="flex justify-between gap-2">
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

/** What the posts gained each day, by kind, with its table. */
export const ActivityBody = ({ figures }: { readonly figures: Figures }) => {
  const words = useTrendWords();

  const keys: readonly EngagementKey[] =
    figures.totals.quotes === null
      ? ["likes", "reposts", "replies"]
      : ["likes", "reposts", "replies", "quotes"];

  return (
    <>
      <Headline
        value={figures.totals.engagement}
        hint={words.trend(
          figures.totals.engagement,
          figures.previousTotals.engagement,
          figures.previousKept
        )}
      />
      <EngagementChart days={figures.days} keys={keys} />
    </>
  );
};

const compared = ["posts", "engagement", "impressions", "reach"] as const;

/** The range's totals beside the range before, four tiles. */
export const ComparisonBody = ({ figures }: { readonly figures: Figures }) => {
  const t = useTranslations("Analytics");
  const words = useTrendWords();

  return (
    <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
 * The posts people did the most with, a line each: where it went out,
 * when, and its engagement. `PostLink` links a line to the post's page,
 * `Excerpt` gives the first line of its text once it is read.
 */
export const TopPostsBody = ({
  channels,
  dashboard,
  Excerpt,
  PostLink,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly dashboard: AnalyticsDashboard;
  readonly Excerpt: ComponentType<{
    readonly postId: string;
    readonly workspaceId: string;
  }>;
  readonly PostLink: ComponentType<PostLinkProps>;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Analytics");
  const format = useFormatter();

  if (dashboard.topPosts.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("top.empty")}</p>;
  }

  return (
    <ol className="-mx-2 flex flex-col">
      {dashboard.topPosts.map((post) => {
        const channel = channels.find(({ id }) => id === post.channelId);

        return (
          <li key={post.targetId}>
            <PostLink postId={post.postId} workspaceId={workspaceId}>
              <span className="hover:bg-muted flex items-center justify-between gap-4 rounded-md px-2 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {channel === undefined
                      ? t("widgets.channelGone")
                      : channelName(channel)}
                  </span>
                  <span className="text-muted-foreground truncate text-sm">
                    <Excerpt postId={post.postId} workspaceId={workspaceId} />
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-medium tabular-nums">
                    {t("top.engagement", { count: post.engagement })}
                  </span>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {format.dateTime(DateTime.toDate(post.publishedAt), {
                      dateStyle: "medium",
                    })}
                  </span>
                </span>
              </span>
            </PostLink>
          </li>
        );
      })}
    </ol>
  );
};

/** Each channel's followers, posts and engagement over the range. */
export const ChannelsBody = ({
  channels,
  dashboard,
}: {
  readonly channels: readonly SocialChannel[];
  readonly dashboard: AnalyticsDashboard;
}) => {
  const t = useTranslations("Analytics");
  const tPosts = useTranslations("Posts");
  const words = useTrendWords();

  if (dashboard.channels.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("widgets.noDays")}</p>
    );
  }

  return (
    <Table>
      <TableCaption className="sr-only">{t("totals.caption")}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t("totals.channel")}</TableHead>
          <TableHead scope="col" className="text-right">
            {t("metric", { metric: "followers" })}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {t("metric", { metric: "posts" })}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {t("metric", { metric: "engagement" })}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboard.channels.map((numbers) => {
          const channel = channels.find(({ id }) => id === numbers.channelId);

          return (
            <TableRow key={numbers.channelId}>
              <TableHead scope="row" className="max-w-48">
                {channel === undefined ? (
                  t("widgets.channelGone")
                ) : (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{channelName(channel)}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {tPosts("platform", { platform: channel.platform })}
                    </span>
                  </span>
                )}
              </TableHead>
              <TableCell variant="numeric">
                {words.count(numbers.followers.current)}
              </TableCell>
              <TableCell variant="numeric">
                {words.count(numbers.totals.posts)}
              </TableCell>
              <TableCell variant="numeric">
                {words.count(numbers.totals.engagement)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const platformColumns: readonly (keyof DashboardTotals)[] = [
  "posts",
  "engagement",
  "impressions",
];

/** Each platform's posts, engagement and impressions over the range. */
export const PlatformsBody = ({
  dashboard,
}: {
  readonly dashboard: AnalyticsDashboard;
}) => {
  const t = useTranslations("Analytics");
  const tPosts = useTranslations("Posts");
  const words = useTrendWords();

  if (dashboard.platforms.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t("widgets.noDays")}</p>
    );
  }

  return (
    <Table>
      <TableCaption className="sr-only">
        {t("widgets.name", { kind: "platforms" })}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">
            {t("widgets.name", { kind: "platforms" })}
          </TableHead>
          {platformColumns.map((metric) => (
            <TableHead key={metric} scope="col" className="text-right">
              {t("metric", { metric })}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {dashboard.platforms.map(({ platform, totals }) => (
          <TableRow key={platform}>
            <TableHead scope="row">
              {tPosts("platform", { platform })}
            </TableHead>
            {platformColumns.map((metric) => (
              <TableCell key={metric} variant="numeric">
                {words.count(totals[metric])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

/** The exports of the range, as files. */
export const ExportBody = ({
  accounts,
  posts,
}: {
  readonly accounts: string;
  readonly posts: string;
}) => {
  const t = useTranslations("Analytics.export");

  return (
    <div className="mt-auto flex flex-col gap-2">
      <p className="text-muted-foreground text-sm">{t("description")}</p>
      <a
        href={posts}
        download
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("posts")}
      </a>
      <a
        href={accounts}
        download
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("accounts")}
      </a>
    </div>
  );
};
