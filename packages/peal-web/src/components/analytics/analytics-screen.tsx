"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";

import {
  analyticsDashboard,
  analyticsSummary,
  exportUrl,
} from "#analytics/api.ts";
import {
  defaultRange,
  rangeEnding,
  ranges,
  summaryTimeZone,
  todayIn,
} from "#analytics/report.ts";
import { AccountNumbers } from "#components/analytics/account-numbers.tsx";
import { AnalyticsSummaryView } from "#components/analytics/analytics-summary.tsx";
import { BestTimesCard } from "#components/analytics/best-times.tsx";
import { PeriodMenu, usePeriod } from "#components/lists/period-menu.tsx";
import { TimeZoneLine } from "#components/lists/time-zone-line.tsx";
import { InTimeZone } from "#components/notices/in-time-zone.tsx";
import { PageActions } from "#components/shell/frame-view.tsx";
import { workspaceChannels } from "#posts/api.ts";
import { useMounted } from "#posts/use-mounted.ts";
import { browserTimeZone } from "#posts/zoned-time.ts";

const Loading = ({ label }: { readonly label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-4">
    <span className="sr-only">{label}</span>
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

interface AnalyticsViewProps {
  readonly timeZone: string;
  readonly workspaceId: string;
}

const AnalyticsView = ({ timeZone, workspaceId }: AnalyticsViewProps) => {
  const t = useTranslations("Analytics");
  const [range, setRange] = usePeriod(ranges, defaultRange);
  const asked = rangeEnding(todayIn(timeZone), range, timeZone);
  const summaryQuery = analyticsSummary(workspaceId, asked);
  const dashboardQuery = analyticsDashboard(workspaceId, asked);
  const channelsQuery = workspaceChannels(workspaceId);
  const summary = useAtomValue(summaryQuery);
  const dashboard = useAtomValue(dashboardQuery);
  const retryDashboard = useAtomRefresh(dashboardQuery);
  const channels = useAtomValue(channelsQuery);
  const retrySummary = useAtomRefresh(summaryQuery);
  const retryChannels = useAtomRefresh(channelsQuery);

  const body = (() => {
    if (
      AsyncResult.isFailure(summary) ||
      AsyncResult.isFailure(dashboard) ||
      AsyncResult.isFailure(channels)
    ) {
      return (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-sm">{t("page.loadFailed")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              retrySummary();
              retryDashboard();
              retryChannels();
            }}
          >
            {t("page.retry")}
          </Button>
        </div>
      );
    }

    if (
      !AsyncResult.isSuccess(summary) ||
      !AsyncResult.isSuccess(dashboard) ||
      !AsyncResult.isSuccess(channels)
    ) {
      return <Loading label={t("page.loading")} />;
    }

    return (
      <InTimeZone timeZone={timeZone}>
        <div className="flex flex-col gap-10">
          <AccountNumbers
            channels={channels.value}
            dashboard={dashboard.value}
            exports={{
              accounts: exportUrl(workspaceId, "accounts", asked),
              posts: exportUrl(workspaceId, "posts", asked),
            }}
          />
          <AnalyticsSummaryView
            channels={channels.value}
            summary={summary.value}
            workspaceId={workspaceId}
          />
          <BestTimesCard
            channels={channels.value}
            timeZone={timeZone}
            workspaceId={workspaceId}
          />
        </div>
      </InTimeZone>
    );
  })();

  return (
    <div className="flex flex-col gap-8">
      <PageActions>
        <PeriodMenu choices={ranges} value={range} onChange={setRange} />
      </PageActions>
      <div className="flex flex-col gap-3">
        <TimeZoneLine of="days" timeZone={timeZone} className="text-end" />
        {body}
      </div>
    </div>
  );
};

interface AnalyticsScreenProps {
  readonly workspaceId: string;
}

// The analytics render in the browser, where the reader's time zone, and
// so the days of the range, are known: UTC's when the browser cannot tell.
export const AnalyticsScreen = (props: AnalyticsScreenProps) => {
  const t = useTranslations("Analytics");
  const mounted = useMounted();

  if (!mounted) {
    return <Loading label={t("page.loading")} />;
  }

  return (
    <AnalyticsView {...props} timeZone={summaryTimeZone(browserTimeZone())} />
  );
};
