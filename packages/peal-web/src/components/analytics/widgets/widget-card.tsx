"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import type { ReactNode, Ref } from "react";

import type { WidgetHeight, WidgetWidth } from "#analytics/widgets.ts";

/** The columns a widget spans: all of a phone's, up to two, up to four. */
export const widthClasses: Readonly<Record<WidgetWidth, string>> = {
  1: "col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-2 xl:col-span-3",
  4: "sm:col-span-2 xl:col-span-4",
};

/** The rows a widget spans. */
export const heightClasses: Readonly<Record<WidgetHeight, string>> = {
  1: "row-span-1",
  2: "row-span-2",
};

interface WidgetCardViewProps {
  readonly children: ReactNode;
  /** The drag handle, at the card's start, shown on hover and focus. */
  readonly handle?: ReactNode;
  /** The resize handle, at the card's corner, shown on hover and focus. */
  readonly resizer?: ReactNode;
  /** The card's buttons, at the end of its header. */
  readonly actions?: ReactNode;
  /** While the person carries it: lifted, with a shadow. */
  readonly dragging?: boolean;
  /** While the person resizes it: what it shows is blurred until let go. */
  readonly resizing?: boolean;
  readonly height: WidgetHeight;
  readonly name: string;
  /** The element the board sorts, the grid's item. */
  readonly ref?: Ref<HTMLLIElement>;
  /** The period, and the channel where it shows one. */
  readonly subtitle: string;
  /** Its id on the board, which a resize reads every widget's place by. */
  readonly widgetId?: string;
  readonly width: WidgetWidth;
}

/**
 * One widget of the analytics board: a white card, hairline, its name and
 * period at the top, its filter and menu at the header's end, then what it
 * shows, which fills the card at whatever size the person gave it.
 */
export const WidgetCardView = ({
  actions,
  children,
  dragging = false,
  handle,
  height,
  name,
  ref,
  resizer,
  resizing = false,
  subtitle,
  widgetId,
  width,
}: WidgetCardViewProps) => {
  const titleId = useId();

  return (
    <li
      ref={ref}
      data-widget-id={widgetId}
      data-dragging={dragging ? "" : undefined}
      data-resizing={resizing ? "" : undefined}
      className={`group/widget data-[dnd-placeholder]:after:border-border data-[dnd-placeholder]:after:bg-muted/50 relative flex min-h-0 min-w-0 data-[dnd-placeholder]:after:visible data-[dnd-placeholder]:after:absolute data-[dnd-placeholder]:after:inset-0 data-[dnd-placeholder]:after:rounded-lg data-[dnd-placeholder]:after:border-2 data-[dnd-placeholder]:after:border-dashed data-[resizing]:z-20 data-[resizing]:h-(--resize-height) data-[resizing]:w-(--resize-width) data-[resizing]:translate-x-(--resize-x) data-[resizing]:translate-y-(--resize-y) data-[resizing]:self-start data-[resizing]:justify-self-start ${widthClasses[width]} ${heightClasses[height]}`}
    >
      {handle}
      <article
        aria-labelledby={titleId}
        className="bg-card group-data-[resizing]/widget:ring-brand flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden rounded-lg border p-6 transition duration-300 group-data-[dragging]/widget:scale-102 group-data-[dragging]/widget:shadow-xl group-data-[resizing]/widget:shadow-lg group-data-[resizing]/widget:ring-2"
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 transition group-data-[resizing]/widget:opacity-60 group-data-[resizing]/widget:blur-sm">
          {children}
        </div>
      </article>
      {resizer}
    </li>
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
