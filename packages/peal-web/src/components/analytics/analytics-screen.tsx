"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";

import { summaryTimeZone } from "#analytics/report.ts";
import { AnalyticsBoard } from "#components/analytics/widgets/analytics-board.tsx";
import { InTimeZone } from "#components/notices/in-time-zone.tsx";
import { workspaceChannels } from "#posts/api.ts";
import { useMounted } from "#posts/use-mounted.ts";
import { browserTimeZone } from "#posts/zoned-time.ts";

const Loading = ({ label }: { readonly label: string }) => (
  <div
    aria-busy="true"
    className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
  >
    <span className="sr-only">{label}</span>
    <Skeleton className="h-56 w-full" />
    <Skeleton className="h-56 w-full sm:col-span-2" />
    <Skeleton className="h-56 w-full" />
    <Skeleton className="h-72 w-full sm:col-span-2 xl:col-span-4" />
  </div>
);

interface AnalyticsViewProps {
  readonly timeZone: string;
  readonly workspaceId: string;
}

// The board, once the workspace's channels, which its filters name, came.
const BoardOfChannels = ({ timeZone, workspaceId }: AnalyticsViewProps) => {
  const t = useTranslations("Analytics");
  const channelsQuery = workspaceChannels(workspaceId);
  const channels = useAtomValue(channelsQuery);
  const retryChannels = useAtomRefresh(channelsQuery);

  return AsyncResult.match(channels, {
    onFailure: () => (
      <div className="flex flex-col items-start gap-3" role="alert">
        <p className="text-sm">{t("page.loadFailed")}</p>
        <Button variant="outline" size="sm" onClick={retryChannels}>
          {t("page.retry")}
        </Button>
      </div>
    ),
    onInitial: () => <Loading label={t("page.loading")} />,
    onSuccess: ({ value }) => (
      <InTimeZone timeZone={timeZone}>
        <AnalyticsBoard
          channels={value}
          timeZone={timeZone}
          workspaceId={workspaceId}
        />
      </InTimeZone>
    ),
  });
};

const AnalyticsView = ({ timeZone, workspaceId }: AnalyticsViewProps) => (
  <BoardOfChannels timeZone={timeZone} workspaceId={workspaceId} />
);

interface AnalyticsScreenProps {
  readonly workspaceId: string;
}

// The analytics render in the browser, where the reader's time zone, and
// so the days of each widget's period, are known: UTC's when the browser
// cannot tell. The board itself is the browser's too.
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
