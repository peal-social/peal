"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardAction,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import { Skeleton } from "peal-ui/components/skeleton";

import {
  defaultRange,
  rangeEnding,
  ranges,
  todayIn,
} from "#analytics/report.ts";
import type { Range } from "#analytics/report.ts";
import { usageOf } from "#billing/api.ts";
import { WorkspaceUsageHistory } from "#components/billing/usage-history.tsx";
import { PeriodMenu, usePeriod } from "#components/lists/period-menu.tsx";

// The last `range` UTC days, today included, as the usage counts them.
const periodOf = (range: Range) => {
  const { from, to } = rangeEnding(todayIn("UTC"), range, "UTC");

  return { from, to };
};

const Loaded = ({
  range,
  workspaceId,
}: {
  readonly range: Range;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Billing.usage.history");
  const query = usageOf(workspaceId, periodOf(range));
  const report = useAtomValue(query);
  const retry = useAtomRefresh(query);

  if (AsyncResult.isSuccess(report)) {
    return <WorkspaceUsageHistory report={report.value} />;
  }

  return AsyncResult.isFailure(report) ? (
    <div className="flex flex-col items-start gap-3" role="alert">
      <p className="text-sm">{t("loadFailed")}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  ) : (
    <div aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-64 w-full" />
    </div>
  );
};

/**
 * The billing page's usage by day: the last 7, 30 or 90 UTC days, read by
 * the browser with the member's session. It renders after hydration, as
 * the billing page does, since today is the browser's.
 */
export const UsageHistoryScreen = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Billing.usage.history");
  const [range, setRange] = usePeriod(ranges, defaultRange);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
        <CardAction>
          <PeriodMenu choices={ranges} value={range} onChange={setRange} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <Loaded range={range} workspaceId={workspaceId} />
        </div>
      </CardContent>
    </Card>
  );
};
