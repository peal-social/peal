"use client";

import { useFormatter, useTranslations } from "next-intl";

import { trendOf } from "#analytics/report.ts";

const directionOf = (change: number): "fewer" | "more" | "same" => {
  if (change === 0) {
    return "same";
  }

  return change > 0 ? "more" : "fewer";
};

/**
 * How the analytics say a number and how it moved: a count, or that the
 * platform does not give it; the change against the range before, or why
 * there is none; what followers gained.
 */
export const useTrendWords = () => {
  const t = useTranslations("Analytics");
  const format = useFormatter();

  const count = (value: number | null): string =>
    value === null ? t("totals.notGiven") : format.number(value);

  const trend = (
    now: number | null,
    before: number | null,
    previousKept: boolean
  ): string => {
    // The range before is gone in part on some platform: no change to say.
    if (!previousKept) {
      return t("trend.notKept");
    }

    const found = trendOf(now, before);

    if (found === null) {
      return t("trend.unknown");
    }

    if (found.change === 0) {
      return t("trend.same");
    }

    const share =
      found.share === null
        ? null
        : format.number(found.share, {
            maximumFractionDigits: 0,
            signDisplay: "always",
            style: "percent",
          });

    return t(found.change > 0 ? "trend.more" : "trend.fewer", {
      count: format.number(Math.abs(found.change)),
      share: share ?? "",
      shared: share === null ? "no" : "yes",
    });
  };

  const gained = (
    value: number | null,
    range: "current" | "previous"
  ): string =>
    value === null
      ? t("trend.unknown")
      : t("accounts.gained", {
          change: directionOf(value),
          count: format.number(Math.abs(value)),
          range,
        });

  return { count, gained, trend };
};
