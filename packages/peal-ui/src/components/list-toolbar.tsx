"use client";

import { PopoverContent as PopoverContentPrimitive } from "@ui-sdk/react/popover";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

type WithClassName<Props> = Omit<Props, "className"> & {
  readonly className?: string | undefined;
};

/**
 * A list's toolbar, under the page's title (DESIGN.md, "Filters and
 * display"): its views at the start, its tools and actions at the end.
 */
const ListToolbar = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="list-toolbar"
    className={cn("flex flex-wrap items-center gap-2", className)}
    {...props}
  />
);

/** The toolbar's end: Filter, Display, then the page's actions. */
const ListToolbarEnd = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="list-toolbar-end"
    className={cn("ms-auto flex flex-wrap items-center gap-2", className)}
    {...props}
  />
);

/**
 * A tool of the toolbar, Filter or Display: a small outline icon button,
 * marked while what it opens narrows or orders the list (`active`).
 */
const ListToolButton = ({
  active = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { readonly active?: boolean }) => (
  <button
    type="button"
    data-slot="list-tool-button"
    data-active={active ? "" : undefined}
    className={cn(
      buttonVariants({ size: "icon-sm", variant: "outline" }),
      "data-[active]:border-brand data-[active]:text-brand-text",
      className
    )}
    {...props}
  />
);

/** A list's views, at the toolbar's start: pills, the current one lifted. */
const ListViews = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    data-slot="list-views"
    className={cn("flex flex-wrap items-center gap-1.5", className)}
    {...props}
  />
);

/**
 * The classes of one view's link: a pill, its border and muted text, or,
 * for the current view, a lift to `accent`.
 */
const viewTabClass = (current: boolean): string =>
  cn(
    "focus-visible:ring-ring/50 inline-flex h-7.5 items-center rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3",
    current
      ? "bg-accent text-foreground border-transparent"
      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
  );

/** The row of a list's filters, under its toolbar. */
const FilterChips = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="filter-chips"
    className={cn("flex flex-wrap items-center gap-1.5", className)}
    {...props}
  />
);

/**
 * One filter: the property with its icon, the word that joins it to its
 * value, the value (which opens the menu to change it, `onEdit`), and a
 * button that takes it off (`onRemove`, named by `removeLabel`).
 */
const FilterChip = ({
  icon,
  join,
  onEdit,
  onRemove,
  property,
  removeLabel,
  value,
}: {
  readonly icon?: React.ReactNode;
  readonly join: string;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
  readonly property: string;
  readonly removeLabel: string;
  readonly value: React.ReactNode;
}) => (
  <span
    data-slot="filter-chip"
    className="bg-card divide-border inline-flex h-7 items-stretch divide-x overflow-hidden rounded-md border text-xs"
  >
    <span className="text-muted-foreground flex items-center gap-1.5 px-2 [&_svg]:size-3.5">
      {icon}
      {property}
    </span>
    <span className="text-muted-foreground flex items-center px-2">{join}</span>
    <button
      type="button"
      className="hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-1.5 px-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset"
      onClick={onEdit}
    >
      {value}
    </button>
    <button
      type="button"
      aria-label={removeLabel}
      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 flex items-center px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset [&_svg]:size-3.5"
      onClick={onRemove}
    >
      <XIcon aria-hidden />
    </button>
  </span>
);

/** Clear, after the chips: a small ghost button. */
const FilterChipsClear = ({
  className,
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type="button"
    data-slot="filter-chips-clear"
    className={cn(buttonVariants({ size: "xs", variant: "ghost" }), className)}
    {...props}
  />
);

/**
 * The Filter menu's popup: the command menu's parts in a popover, with no
 * padding of its own, as wide as a value's name needs.
 */
const FilterMenuContent = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof PopoverContentPrimitive>>) => (
  <PopoverContentPrimitive
    data-slot="filter-menu-content"
    align="end"
    side="bottom"
    sideOffset={4}
    className={cn(
      "bg-popover text-popover-foreground ring-foreground/10 z-50 flex max-h-[min(24rem,var(--available-height))] w-72 origin-(--transform-origin) flex-col overflow-hidden rounded-lg shadow-md ring-1 outline-hidden transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
      className
    )}
    {...props}
  />
);

/** The Display panel: its settings, one a row. */
const DisplayMenuContent = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof PopoverContentPrimitive>>) => (
  <PopoverContentPrimitive
    data-slot="display-menu-content"
    align="end"
    side="bottom"
    sideOffset={4}
    className={cn(
      "bg-popover text-popover-foreground ring-foreground/10 z-50 flex w-72 origin-(--transform-origin) flex-col gap-3 rounded-lg p-3 text-sm shadow-md ring-1 outline-hidden transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
      className
    )}
    {...props}
  />
);

/** One setting of the Display panel: its name, then its control. */
const DisplayRow = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="display-row"
    className={cn(
      "text-muted-foreground flex items-center justify-between gap-2",
      className
    )}
    {...props}
  />
);

export {
  DisplayMenuContent,
  DisplayRow,
  FilterChip,
  FilterChips,
  FilterChipsClear,
  FilterMenuContent,
  ListToolbar,
  ListToolbarEnd,
  ListViews,
  ListToolButton,
  viewTabClass,
};
