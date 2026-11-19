"use client";

import {
  Toolbar as ToolbarPrimitive,
  ToolbarButton as ToolbarButtonPrimitive,
} from "@ui-sdk/react/toolbar";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

type WithClassName<Props> = Omit<Props, "className"> & {
  readonly className?: string | undefined;
};

/**
 * The small pill that shows while items of a list are chosen: how many,
 * a button that opens the actions (the command menu, on the choice), and
 * one that lets go. It sticks to the window's foot under the list, centred
 * on it. One tab stop, its buttons reached with the arrow keys; `label`
 * names it for screen readers.
 */
const SelectionBar = ({
  className,
  label,
  ...props
}: WithClassName<React.ComponentProps<typeof ToolbarPrimitive>> & {
  readonly label: string;
}) => (
  <div
    data-slot="selection-bar-place"
    className="pointer-events-none sticky bottom-6 z-40 flex justify-center"
  >
    <ToolbarPrimitive
      aria-label={label}
      className={cn(
        "bg-popover text-popover-foreground ring-foreground/10 pointer-events-auto flex h-10 items-center gap-1 rounded-full py-1 pr-1 pl-4 shadow-lg ring-1",
        className
      )}
      {...props}
    />
  </div>
);

/** How many items are chosen, at the pill's start. */
const SelectionCount = ({
  className,
  ...props
}: React.ComponentProps<"output">) => (
  <output
    data-slot="selection-count"
    className={cn(
      "text-muted-foreground mr-2 text-sm whitespace-nowrap tabular-nums",
      className
    )}
    {...props}
  />
);

/**
 * The pill's button: "⌘ Actions", whose icon goes first. A light rounded
 * button, as the pill is.
 */
const SelectionBarAction = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof ToolbarButtonPrimitive>>) => (
  <ToolbarButtonPrimitive
    className={cn(
      "bg-secondary text-secondary-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
);

/** Lets go of the choice: a round icon button named by `label`. */
const SelectionBarClear = ({
  className,
  label,
  ...props
}: WithClassName<React.ComponentProps<typeof ToolbarButtonPrimitive>> & {
  readonly label: string;
}) => (
  <ToolbarButtonPrimitive
    aria-label={label}
    className={cn(
      "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 inline-flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3 [&_svg]:size-4",
      className
    )}
    {...props}
  >
    <XIcon aria-hidden />
  </ToolbarButtonPrimitive>
);

export { SelectionBar, SelectionBarAction, SelectionBarClear, SelectionCount };
