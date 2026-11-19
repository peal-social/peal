"use client";

import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";

import { usePathname, useRouter } from "#i18n/navigation.ts";

/**
 * The period a screen shows (DESIGN.md, "Lists: filters and display"),
 * read from its address: `?period=` and the number of days, or the
 * screen's default, which the address leaves out. Choosing one replaces
 * the address without scrolling. `key` names another parameter, for a
 * part of a page with a period of its own.
 */
export const usePeriod = <Period extends string>(
  choices: readonly Period[],
  fallback: Period,
  key = "period"
) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get(key);
  const period = choices.find((choice) => choice === asked) ?? fallback;

  const choose = (next: Period) => {
    const query = new URLSearchParams(params.toString());

    if (next === fallback) {
      query.delete(key);
    } else {
      query.set(key, next);
    }

    const written = query.toString();

    router.replace(written === "" ? pathname : `${pathname}?${written}`, {
      scroll: false,
    });
  };

  return [period, choose] as const;
};

/**
 * Period: a small outline button naming the days shown ("Last 30 days"),
 * which opens the periods the screen offers, the chosen one ticked.
 */
export const PeriodMenu = <Period extends string>({
  choices,
  onChange,
  value,
}: {
  /** The periods offered, each a number of days. */
  readonly choices: readonly Period[];
  readonly onChange: (period: Period) => void;
  readonly value: Period;
}) => {
  const t = useTranslations("Lists");
  const shown = t("lastDays", { days: Number(value) });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={t("periodIs", { period: shown })}
          />
        }
      >
        <CalendarIcon aria-hidden />
        {shown}
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("period")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(chosen: string) => {
              const found = choices.find((choice) => choice === chosen);

              if (found !== undefined) {
                onChange(found);
              }
            }}
          >
            {choices.map((choice) => (
              <DropdownMenuRadioItem key={choice} value={choice}>
                {t("lastDays", { days: Number(choice) })}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
