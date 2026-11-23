"use client";

import { Schema } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { useId } from "react";

import {
  HourFormatSchema,
  saveHourFormat,
  timeOptionsOf,
  useHourFormat,
} from "#i18n/hour-cycle.ts";
import type { HourFormat } from "#i18n/hour-cycle.ts";

// An afternoon time, which the two clocks write differently.
const example = Date.UTC(2000, 0, 1, 14, 30);

const isHourFormat = Schema.is(HourFormatSchema);

/** The three ways to write a time, each named with an example. */
export const useTimeFormatLabels = (): Readonly<Record<HourFormat, string>> => {
  const t = useTranslations("AccountSettings.timeFormat");
  const format = useFormatter();

  const labelOf = (option: HourFormat) =>
    t("option", {
      example: format.dateTime(example, {
        timeStyle: "short",
        timeZone: "UTC",
        ...timeOptionsOf(option),
      }),
      format: option,
    });

  return { auto: labelOf("auto"), h12: labelOf("h12"), h24: labelOf("h24") };
};

/** The time format's row: the three formats in a select. */
export const TimeFormatFields = ({
  onChange,
  value,
}: {
  readonly onChange: (format: HourFormat) => void;
  readonly value: HourFormat;
}) => {
  const t = useTranslations("AccountSettings.timeFormat");
  const labels = useTimeFormatLabels();
  const labelId = useId();
  const hintId = useId();

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel id={labelId}>{t("title")}</SettingsRowLabel>
        <SettingsRowDescription id={hintId}>
          {t("description")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <Select
          value={value}
          onValueChange={(chosen: string | null) => {
            if (isHourFormat(chosen)) {
              onChange(chosen);
            }
          }}
        >
          <SelectTrigger aria-labelledby={labelId} aria-describedby={hintId}>
            <SelectValue>{labels[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HourFormatSchema.literals.map((option) => (
              <SelectItem key={option} value={option}>
                {labels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRowControl>
    </SettingsRow>
  );
};

/**
 * How this browser writes times of day: as the language does, on a 12-hour
 * clock or on a 24-hour one. The choice applies at once, and stays in this
 * browser.
 */
export const TimeFormatRow = () => (
  <TimeFormatFields value={useHourFormat()} onChange={saveHourFormat} />
);
