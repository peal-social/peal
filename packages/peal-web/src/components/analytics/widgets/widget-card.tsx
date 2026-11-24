"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import type { DragEventHandler, ReactNode } from "react";

import type { WidgetSize } from "#analytics/widgets.ts";

/** Where a widget sits in the board's grid, by its size. */
export const sizeClasses: Readonly<Record<WidgetSize, string>> = {
  medium: "sm:col-span-2",
  small: "col-span-1",
  wide: "sm:col-span-2 xl:col-span-4",
};

/** Which side of a widget another one dragged over it would land on. */
export type DropSide = "before" | "after";

interface WidgetCardViewProps {
  readonly children: ReactNode;
  /** The drag handle, at the card's start, shown on hover and focus. */
  readonly handle?: ReactNode;
  /** The card's buttons, at the end of its header. */
  readonly actions?: ReactNode;
  /** Where a widget being dragged would land, while one is over this. */
  readonly dropSide?: DropSide | null;
  readonly dragging?: boolean;
  readonly name: string;
  readonly onDragOver?: DragEventHandler<HTMLElement>;
  readonly onDragLeave?: DragEventHandler<HTMLElement>;
  readonly onDrop?: DragEventHandler<HTMLElement>;
  readonly size: WidgetSize;
  /** The period, and the channel where it shows one. */
  readonly subtitle: string;
}

/**
 * One widget of the analytics board: a white card, hairline, its name and
 * period at the top, its filter and menu at the header's end, then what it
 * shows.
 */
export const WidgetCardView = ({
  actions,
  children,
  dragging = false,
  dropSide = null,
  handle,
  name,
  onDragLeave,
  onDragOver,
  onDrop,
  size,
  subtitle,
}: WidgetCardViewProps) => {
  const titleId = useId();

  // The card is a drop target while another widget is dragged: the
  // keyboard moves widgets from their menu instead.
  return (
    <div
      data-dragging={dragging ? "" : undefined}
      data-drop={dropSide ?? undefined}
      className={`group/widget data-[drop=after]:after:bg-brand data-[drop=before]:before:bg-brand relative flex min-w-0 data-[dragging]:opacity-50 data-[drop=after]:after:absolute data-[drop=after]:after:inset-y-0 data-[drop=after]:after:-right-3.5 data-[drop=after]:after:w-0.5 data-[drop=after]:after:rounded-full data-[drop=before]:before:absolute data-[drop=before]:before:inset-y-0 data-[drop=before]:before:-left-3.5 data-[drop=before]:before:w-0.5 data-[drop=before]:before:rounded-full ${sizeClasses[size]}`}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {handle}
      <article
        aria-labelledby={titleId}
        className="bg-card flex min-w-0 flex-1 flex-col gap-4 rounded-lg border p-6"
      >
        <header className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2
              id={titleId}
              className="truncate text-sm leading-snug font-semibold"
            >
              {name}
            </h2>
            <p className="text-muted-foreground truncate text-sm">{subtitle}</p>
          </div>
          {actions === undefined ? null : (
            <div className="-mt-1 -mr-2 flex shrink-0 items-center">
              {actions}
            </div>
          )}
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      </article>
    </div>
  );
};

/**
 * A widget's headline number, with a muted line under it. A number no
 * platform gives is a dash, never zero, and the line says so.
 */
export const Headline = ({
  hint,
  value,
}: {
  readonly hint?: string | undefined;
  readonly value: number | null;
}) => {
  const t = useTranslations("Analytics.totals");
  const format = useFormatter();
  const under = value === null ? t("notGiven") : hint;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">
        {value === null ? (
          <span aria-hidden="true">—</span>
        ) : (
          format.number(value)
        )}
      </p>
      {under === undefined ? null : (
        <p className="text-muted-foreground text-sm">{under}</p>
      )}
    </div>
  );
};
