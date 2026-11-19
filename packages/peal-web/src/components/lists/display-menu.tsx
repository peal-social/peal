"use client";

import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  DisplayMenuContent,
  DisplayRow,
  ListToolButton,
} from "peal-ui/components/list-toolbar";
import { Popover, PopoverTrigger } from "peal-ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "peal-ui/components/tooltip";
import { useId } from "react";
import type { ReactNode } from "react";

/** Which way a list is ordered. */
export type Direction = "asc" | "desc";

/** What a list can be ordered by. */
export interface OrderingField {
  readonly id: string;
  readonly label: string;
}

/**
 * The Display panel (DESIGN.md, "Filters and display"): the toolbar's
 * Display button and its popover, with the list's ordering (`fields`,
 * `field`) and a button that turns its direction. `active` marks the
 * button while the ordering is not the list's default. `note` says what an
 * ordering changes, like an ordering by time leaving out posts without one.
 */
export const DisplayMenu = ({
  active,
  direction,
  field,
  fields,
  note,
  onChange,
}: {
  readonly active: boolean;
  readonly direction: Direction;
  readonly field: string;
  readonly fields: readonly OrderingField[];
  readonly note?: ReactNode;
  readonly onChange: (field: string, direction: Direction) => void;
}) => {
  const t = useTranslations("Lists");
  const id = useId();
  const shown = fields.find((option) => option.id === field);
  const turned = direction === "asc" ? "desc" : "asc";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <ListToolButton aria-label={t("display")} active={active} />
              }
            />
          }
        >
          <SlidersHorizontalIcon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>{t("display")}</TooltipContent>
      </Tooltip>
      <DisplayMenuContent>
        <DisplayRow>
          <span id={id}>{t("ordering")}</span>
          <span className="flex items-center gap-1">
            <Select
              value={field}
              onValueChange={(chosen: string | null) => {
                if (chosen !== null) {
                  onChange(chosen, direction);
                }
              }}
            >
              <SelectTrigger aria-labelledby={id} size="sm">
                <SelectValue>{shown?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {fields.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("direction", { direction: turned })}
              title={t("direction", { direction: turned })}
              onClick={() => {
                onChange(field, turned);
              }}
            >
              {direction === "asc" ? (
                <ArrowUpNarrowWideIcon aria-hidden />
              ) : (
                <ArrowDownWideNarrowIcon aria-hidden />
              )}
            </Button>
          </span>
        </DisplayRow>
        {note === undefined ? null : (
          <p className="text-muted-foreground text-xs">{note}</p>
        )}
      </DisplayMenuContent>
    </Popover>
  );
};
