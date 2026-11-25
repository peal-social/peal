"use client";

import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import type { MetricsSnapshot } from "peal-contract";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "peal-ui/components/tabs";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { readingTicksOf } from "#analytics/reading-ticks.ts";
import type { TickLabel } from "#analytics/reading-ticks.ts";
import { readingRows } from "#analytics/report.ts";
import type { EngagementKey } from "#analytics/report.ts";
import { useTimeOptions } from "#i18n/hour-cycle.ts";

interface ReadingsChartProps {
  /** Names the channel and its platform, for the table's caption. */
  readonly channel: string;
  readonly snapshots: readonly MetricsSnapshot[];
}

/**
 * How each count's line is drawn. A line must be seen, so each colour is
 * 3:1 or more on white (DESIGN.md, Colors): blue 5.2:1, deep blue 10.5:1,
 * muted grey 5.3:1, ink 19.8:1. Three are dashed, each its own way, so no
 * line is told apart by its colour alone.
 */
export const readingLines: Readonly<
  Record<EngagementKey, { readonly color: string; readonly dash: string }>
> = {
  likes: { color: "var(--chart-1)", dash: "none" },
  quotes: { color: "var(--foreground)", dash: "8 3 2 3" },
  replies: { color: "var(--chart-5)", dash: "2 3" },
  reposts: { color: "var(--chart-4)", dash: "6 3" },
};

// The chart's legend: each line's colour and dash beside its name, as the
// chart draws them.
const ReadingsLegend = ({
  keys,
  label,
}: {
  readonly keys: readonly EngagementKey[];
  readonly label: (key: EngagementKey) => string;
}) => (
  <div
    aria-hidden="true"
    className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs"
  >
    {keys.map((key) => (
      <div key={key} className="flex items-center gap-1.5">
        <svg width="16" height="4" viewBox="0 0 16 4">
          <line
            x1="0"
            y1="2"
            x2="16"
            y2="2"
            stroke={readingLines[key].color}
            strokeDasharray={readingLines[key].dash}
            strokeWidth="2"
          />
        </svg>
        {label(key)}
      </div>
    ))}
  </div>
);

/**
 * A post's counts on one channel each time they were read, as lines, with
 * the same figures as a table: the chart is hidden from screen readers,
 * whose users take the table. Times are in the page's provider zone.
 */
export const ReadingsChart = ({ channel, snapshots }: ReadingsChartProps) => {
  const t = useTranslations("Analytics");
  const format = useFormatter();
  const timeZone = useTimeZone();
  const timeOptions = useTimeOptions();
  const rows = readingRows(snapshots);

  const keys: readonly EngagementKey[] = snapshots.some(
    ({ metrics }) => metrics.quotes !== null
  )
    ? ["likes", "reposts", "replies", "quotes"]
    : ["likes", "reposts", "replies"];

  const config: ChartConfig = Object.fromEntries(
    keys.map((key) => [
      key,
      { color: readingLines[key].color, label: t("metric", { metric: key }) },
    ])
  );

  // The axis marks days, or hours with the day where it changes.
  const ticks = readingTicksOf(
    rows[0]?.at ?? 0,
    rows.at(-1)?.at ?? 0,
    timeZone ?? "UTC"
  );

  const labels = new Map<number, TickLabel>(
    ticks.map(({ at, label }) => [at, label])
  );

  const tick = (at: number) => {
    const label = labels.get(at) ?? "day";
    const day = { day: "numeric", month: "short" } as const;

    const time = {
      hour: "numeric",
      minute: "2-digit",
      ...timeOptions,
    } as const;

    if (label === "day") {
      return format.dateTime(new Date(at), day);
    }

    return format.dateTime(
      new Date(at),
      label === "time" ? time : { ...day, ...time }
    );
  };

  const when = (at: string | number | undefined) =>
    format.dateTime(new Date(Number(at)), {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <Tabs defaultValue="chart">
      <TabsList aria-label={t("chart.views")}>
        <TabsTrigger value="chart">{t("chart.chart")}</TabsTrigger>
        <TabsTrigger value="table">{t("chart.table")}</TabsTrigger>
      </TabsList>
      <TabsContent value="chart">
        <ChartContainer
          aria-hidden="true"
          config={config}
          className="aspect-auto h-48 w-full"
        >
          <LineChart accessibilityLayer={false} data={[...rows]}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="at"
              domain={["dataMin", "dataMax"]}
              minTickGap={24}
              scale="time"
              tickFormatter={tick}
              ticks={ticks.map(({ at }) => at)}
              tickLine={false}
              type="number"
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickFormatter={(value: number) => format.number(value)}
              tickLine={false}
              width={40}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatLabel={when}
                  formatValue={(value) => format.number(value)}
                />
              }
            />
            {keys.map((key) => (
              <Line
                key={key}
                dataKey={key}
                dot={false}
                stroke={readingLines[key].color}
                strokeDasharray={readingLines[key].dash}
                strokeWidth={2}
                type="monotone"
              />
            ))}
          </LineChart>
        </ChartContainer>
        <ReadingsLegend
          keys={keys}
          label={(key) => t("metric", { metric: key })}
        />
      </TabsContent>
      <TabsContent value="table">
        <Table>
          <TableCaption>{t("post.tableCaption", { channel })}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("post.readAtColumn")}</TableHead>
              {keys.map((key) => (
                <TableHead key={key} scope="col" className="text-right">
                  {t("metric", { metric: key })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.at}>
                <TableHead scope="row">{when(row.at)}</TableHead>
                {keys.map((key) => (
                  <TableCell key={key} variant="numeric">
                    {format.number(row[key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
};
