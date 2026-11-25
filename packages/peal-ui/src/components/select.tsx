"use client";

import {
  Select as SelectPrimitive,
  SelectContent as SelectContentPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectGroupLabel as SelectGroupLabelPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectItemIcon,
  SelectItemIndicator,
  SelectItemText,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
  SelectValueIcon as SelectValueIconPrimitive,
} from "@ui-sdk/react/select";
import type { SelectProps } from "@ui-sdk/react/select";
import { ChevronDownIcon, CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

type WithClassName<Props> = Omit<Props, "className"> & {
  readonly className?: string | undefined;
};

const SelectGroup = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectGroupPrimitive>>) => (
  <SelectGroupPrimitive
    className={cn("scroll-my-1 p-1", className)}
    {...props}
  />
);

const SelectValue = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectValuePrimitive>>) => (
  <SelectValuePrimitive
    className={cn("flex flex-1 text-left", className)}
    {...props}
  />
);

const SelectTrigger = ({
  className,
  size = "default",
  children,
  ...props
}: Omit<
  WithClassName<React.ComponentProps<typeof SelectTriggerPrimitive>>,
  "children"
> & {
  readonly children?: React.ReactNode;
  readonly size?: "sm" | "default";
}) => (
  <SelectTriggerPrimitive
    data-size={size}
    className={cn(
      "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8.5 data-[size=sm]:h-7.5 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDownIcon
      aria-hidden
      className="text-muted-foreground pointer-events-none size-4"
    />
  </SelectTriggerPrimitive>
);

const SelectContent = ({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectContentPrimitive>>) => (
  <SelectContentPrimitive
    side={side}
    sideOffset={sideOffset}
    align={align}
    alignOffset={alignOffset}
    alignItemWithTrigger={alignItemWithTrigger}
    data-align-trigger={alignItemWithTrigger}
    className={cn(
      "bg-popover text-popover-foreground ring-foreground/10 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg shadow-md ring-1 transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 data-[align-trigger=true]:animate-none",
      className
    )}
    {...props}
  />
);

const SelectLabel = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectGroupLabelPrimitive>>) => (
  <SelectGroupLabelPrimitive
    className={cn("text-muted-foreground px-1.5 py-1 text-xs", className)}
    {...props}
  />
);

const SelectItem = ({
  className,
  children,
  icon = null,
  ...props
}: Omit<
  WithClassName<React.ComponentProps<typeof SelectItemPrimitive>>,
  "children"
> & {
  readonly children?: React.ReactNode;
  /**
   * A mark before the item's text, kept out of its name, typeahead and
   * search; `SelectValueIcon` shows the chosen one's in the trigger.
   */
  readonly icon?: React.ReactNode;
}) => (
  <SelectItemPrimitive
    className={cn(
      "data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
      className
    )}
    {...props}
  >
    {icon === null ? null : (
      <SelectItemIcon className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
        {icon}
      </SelectItemIcon>
    )}
    <SelectItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
      {children}
    </SelectItemText>
    <SelectItemIndicator
      render={
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
      }
    >
      <CheckIcon className="pointer-events-none" />
    </SelectItemIndicator>
  </SelectItemPrimitive>
);

const SelectSeparator = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectSeparatorPrimitive>>) => (
  <SelectSeparatorPrimitive
    className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
    {...props}
  />
);

/** The chosen item's `icon`, in the trigger before its value. */
const SelectValueIcon = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof SelectValueIconPrimitive>>) => (
  <SelectValueIconPrimitive
    className={cn(
      "flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5",
      className
    )}
    {...props}
  />
);

/**
 * ui-sdk renders the select's form value, a hidden textarea, after its parts
 * and absolutely positioned. The `select-control` box around them is its
 * positioning context, so it stays by the trigger: without it, the textarea
 * is laid out against a distant ancestor, and below the fold of a scrolling
 * panel it stretches the document. The box is block-level, as the trigger
 * is, and the trigger's width classes read it as they read the parent.
 */
const Select = <T = string, Multiple extends boolean | undefined = false>(
  props: SelectProps<T, Multiple>
) => (
  <div data-slot="select-control" className="relative">
    <SelectPrimitive<T, Multiple> {...props} />
  </div>
);

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectValueIcon,
};
