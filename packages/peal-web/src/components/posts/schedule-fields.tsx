"use client";

import { DateTime, Option } from "effect";
import { CalendarIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { Calendar } from "peal-ui/components/calendar";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "peal-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { useMemo, useState } from "react";
import { enUS, fr } from "react-day-picker/locale";

import { useTimeOptions } from "#i18n/hour-cycle.ts";
import { readPhrase } from "#posts/date-phrase.ts";
import type { NumericOrder } from "#posts/date-phrase.ts";
import {
  browserTimeZone,
  firstDayOfWeek,
  instantOf,
  parseTime,
  timeKey,
  timeZoneChoices,
  wallClockOf,
} from "#posts/zoned-time.ts";
import type { CalendarDate } from "#posts/zoned-time.ts";

/** A date, a time and the zone they are read in, as the user picks them. */
export interface ScheduleChoice {
  readonly date: CalendarDate;
  readonly time: string;
  readonly timeZone: string;
}

/** The instant a choice names, if it names one. */
export const instantOfChoice = ({ date, time, timeZone }: ScheduleChoice) =>
  parseTime(time).pipe(
    Option.flatMap((clock) => instantOf({ date, time: clock }, timeZone))
  );

const dayPickerLocales = { en: enUS, fr } as const;

// The day picker works on dates of the browser's own calendar.
const toPickerDate = ({ day, month, year }: CalendarDate) =>
  new Date(year, month - 1, day);

const fromPickerDate = (date: Date): CalendarDate => ({
  day: date.getDate(),
  month: date.getMonth() + 1,
  year: date.getFullYear(),
});

const zoneLabel = (zone: string) => zone.replaceAll("_", " ");

/**
 * What a phrase would set, read now on the choice's clock: the choice it
 * makes (its time kept when the phrase gives none) and the instant, or why
 * it cannot: not understood, or already past.
 */
export const choiceOfPhrase = (
  phrase: string,
  value: ScheduleChoice,
  order: NumericOrder,
  now: DateTime.DateTime
):
  | { readonly kind: "empty" }
  | { readonly kind: "unread" }
  | { readonly kind: "past"; readonly at: DateTime.Utc }
  | {
      readonly kind: "read";
      readonly at: DateTime.Utc;
      readonly choice: ScheduleChoice;
    } => {
  if (phrase.trim() === "") {
    return { kind: "empty" };
  }

  const read = wallClockOf(now, value.timeZone).pipe(
    Option.flatMap((clock) => readPhrase(phrase, clock, order)),
    Option.map(({ date, time }): ScheduleChoice => ({
      ...value,
      date,
      time: Option.match(time, {
        onNone: () => value.time,
        onSome: timeKey,
      }),
    })),
    Option.flatMap((choice) =>
      instantOfChoice(choice).pipe(Option.map((at) => ({ at, choice })))
    )
  );

  return Option.match(read, {
    onNone: () => ({ kind: "unread" }),
    onSome: ({ at, choice }) =>
      DateTime.isGreaterThan(at, now)
        ? { at, choice, kind: "read" }
        : { at, kind: "past" },
  });
};

// A date typed in words, above the pickers: what it reads as shows as it
// is typed, and Enter sets the pickers to it.
const SchedulePhrase = ({ disabled, onChange, value }: ScheduleFieldsProps) => {
  const t = useTranslations("Posts.Composer");
  const format = useFormatter();
  const locale = useLocale();
  const timeOptions = useTimeOptions();
  const [phrase, setPhrase] = useState("");

  const now = DateTime.nowUnsafe();
  const order: NumericOrder = locale === "en" ? "monthFirst" : "dayFirst";
  const read = choiceOfPhrase(phrase, value, order, now);

  const said = (at: DateTime.Utc) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: value.timeZone,
      ...timeOptions,
    });

  const status = (() => {
    if (read.kind === "empty") {
      return t("phraseHint");
    }

    if (read.kind === "unread") {
      return t("phraseUnread");
    }

    return read.kind === "past"
      ? t("phrasePast", { at: said(read.at) })
      : t("phraseRead", {
          at: said(read.at),
          distance: format.relativeTime(DateTime.toDate(read.at), {
            now: DateTime.toDate(now),
          }),
        });
  })();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="schedule-phrase">{t("phraseLabel")}</Label>
      <Input
        id="schedule-phrase"
        value={phrase}
        disabled={disabled}
        autoComplete="off"
        placeholder={t("phrasePlaceholder")}
        aria-describedby="schedule-phrase-status"
        onChange={(event) => {
          setPhrase(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();

            if (read.kind === "read") {
              onChange(read.choice);
              setPhrase("");
            }
          }
        }}
      />
      <p
        id="schedule-phrase-status"
        aria-live="polite"
        className="text-muted-foreground text-sm"
      >
        {status}
      </p>
    </div>
  );
};

interface ScheduleFieldsProps {
  readonly disabled: boolean;
  readonly onChange: (choice: ScheduleChoice) => void;
  readonly value: ScheduleChoice;
}

// When a post goes out: a date from a calendar, a time, and the time zone
// they are read in, the browser's unless the user picks another.
export const ScheduleFields = ({
  disabled,
  onChange,
  value,
}: ScheduleFieldsProps) => {
  const t = useTranslations("Posts.Composer");
  const format = useFormatter();
  const locale = useLocale();
  const timeOptions = useTimeOptions();
  const [open, setOpen] = useState(false);

  const zones = useMemo(
    () => timeZoneChoices(browserTimeZone(), value.timeZone),
    [value.timeZone]
  );

  const at = instantOfChoice(value);

  const dateLabel = format.dateTime(
    Date.UTC(value.date.year, value.date.month - 1, value.date.day),
    { dateStyle: "medium", timeZone: "UTC" }
  );

  return (
    <div className="flex flex-col gap-4">
      <SchedulePhrase disabled={disabled} onChange={onChange} value={value} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label id="schedule-date-label">{t("dateLabel")}</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              disabled={disabled}
              aria-labelledby="schedule-date-label schedule-date"
              render={
                <Button id="schedule-date" variant="outline">
                  <CalendarIcon data-icon="inline-start" />
                  {dateLabel}
                </Button>
              }
            />
            <PopoverContent align="start">
              <Calendar
                mode="single"
                locale={dayPickerLocales[locale]}
                weekStartsOn={firstDayOfWeek(locale) === 7 ? 0 : 1}
                selected={toPickerDate(value.date)}
                defaultMonth={toPickerDate(value.date)}
                onSelect={(picked) => {
                  if (picked !== undefined) {
                    onChange({ ...value, date: fromPickerDate(picked) });
                    setOpen(false);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-time">{t("timeLabel")}</Label>
          <Input
            id="schedule-time"
            type="time"
            value={value.time}
            disabled={disabled}
            required
            onChange={(event) => {
              onChange({ ...value, time: event.target.value });
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label id="schedule-zone-label">{t("timeZoneLabel")}</Label>
          <Select
            value={value.timeZone}
            disabled={disabled}
            onValueChange={(zone) => {
              if (zone !== null) {
                onChange({ ...value, timeZone: zone });
              }
            }}
          >
            <SelectTrigger aria-labelledby="schedule-zone-label">
              <SelectValue>{zoneLabel(value.timeZone)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zoneLabel(zone)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {Option.match(at, {
          onNone: () => t("invalidTime"),
          onSome: (instant) =>
            t("scheduleAt", {
              at: format.dateTime(DateTime.toDate(instant), {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: value.timeZone,
                ...timeOptions,
              }),
            }),
        })}
      </p>
    </div>
  );
};
