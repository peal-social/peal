"use client";

import { DateTime, Option } from "effect";
import { CalendarClockIcon, ListOrderedIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "peal-ui/components/popover";
import {
  Property,
  PropertyLabel,
  PropertyValue,
} from "peal-ui/components/property";
import { useId } from "react";

import { useQueueName } from "#components/posts/queue-choice.tsx";
import type { Placement } from "#components/posts/queue-choice.tsx";
import { instantOfChoice } from "#components/posts/schedule-fields.tsx";
import type { ScheduleChoice } from "#components/posts/schedule-fields.tsx";
import { SchedulePlacementFields } from "#components/posts/schedule-placement.tsx";
import { useTimeOptions } from "#i18n/hour-cycle.ts";
import { browserTimeZone } from "#posts/zoned-time.ts";

/**
 * When the post goes out, as a property of the composer's column: the
 * time chosen, on its zone's clock (named when it is not the browser's),
 * or the next free slot of the queue, named once the workspace's queues
 * are read, which opens the fields that change it.
 */
export const WhenProperty = ({
  choice,
  disabled,
  onChoice,
  onPlacement,
  placement,
  workspaceId,
}: {
  readonly choice: ScheduleChoice;
  readonly disabled: boolean;
  readonly onChoice: (choice: ScheduleChoice) => void;
  readonly onPlacement: (placement: Placement) => void;
  readonly placement: Placement;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Posts.Composer");
  const format = useFormatter();
  const timeOptions = useTimeOptions();
  const labelId = useId();
  const queued = placement._tag === "queue";

  const queueName = useQueueName(
    workspaceId,
    placement._tag === "queue" ? placement.queueId : ""
  );

  const value = queued
    ? Option.match(queueName, {
        onNone: () => t("whenQueued"),
        onSome: (queue) => t("whenQueuedIn", { queue }),
      })
    : Option.match(instantOfChoice(choice), {
        onNone: () => t("invalidTime"),
        onSome: (at) =>
          format.dateTime(DateTime.toDate(at), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: choice.timeZone,
            ...timeOptions,
          }),
      });

  // Another zone than the browser's is named: the time is read on its
  // clock.
  const zone =
    queued || choice.timeZone === browserTimeZone() ? null : choice.timeZone;

  return (
    <Property aria-labelledby={labelId}>
      <PropertyLabel id={labelId}>{t("scheduleLegend")}</PropertyLabel>
      <Popover>
        <PopoverTrigger
          disabled={disabled}
          render={
            <PropertyValue aria-labelledby={`${labelId} ${labelId}-value`} />
          }
        >
          {queued ? (
            <ListOrderedIcon aria-hidden />
          ) : (
            <CalendarClockIcon aria-hidden />
          )}
          <span id={`${labelId}-value`} className="min-w-0 truncate">
            {value}
            {zone === null ? null : (
              <span className="text-muted-foreground"> {zone}</span>
            )}
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <SchedulePlacementFields
            choice={choice}
            placement={placement}
            workspaceId={workspaceId}
            disabled={disabled}
            onChoice={onChoice}
            onPlacement={onPlacement}
          />
        </PopoverContent>
      </Popover>
    </Property>
  );
};
