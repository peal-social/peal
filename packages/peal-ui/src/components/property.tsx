import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * One of an item's properties, in the column beside it (DESIGN.md,
 * "property"): a muted label over its value.
 */
const Property = ({ className, ...props }: React.ComponentProps<"section">) => (
  <section
    data-slot="property"
    className={cn("flex min-w-0 flex-col gap-0.5", className)}
    {...props}
  />
);

/** A property's name, small and muted, over its value. */
const PropertyLabel = ({
  children,
  className,
  ...props
}: React.ComponentProps<"h2">) => (
  <h2
    data-slot="property-label"
    className={cn("text-muted-foreground px-2 text-xs font-medium", className)}
    {...props}
  >
    {children}
  </h2>
);

/**
 * A property's value: the column's width, no fill until hovered, its icon
 * muted, that opens what changes it (render it as a popover's trigger).
 * `data-empty` reads it as what it asks for, in muted text.
 */
const PropertyValue = ({
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type">) => (
  <button
    data-slot="property-value"
    type="button"
    className={cn(
      "hover:bg-accent focus-visible:ring-ring/50 aria-expanded:bg-accent data-[empty]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex min-h-8.5 w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-start text-sm transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
);

/**
 * One row of a property list, in a panel that opens in place (a
 * channel's own fields in the composer): its label at the start, its
 * value beside it, under it on a phone. Hints its value carries with
 * `group-focus-within/property-row:` show while it has the focus.
 */
const PropertyRow = ({
  children,
  className,
  label,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  readonly children: React.ReactNode;
  /** The row's label: a field's `Label`, or words naming the value. */
  readonly label: React.ReactNode;
}) => (
  <div
    data-slot="property-row"
    className={cn(
      "group/property-row grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:items-start",
      className
    )}
    {...props}
  >
    <div className="flex min-w-0 items-center text-sm sm:min-h-8.5">
      {label}
    </div>
    <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
  </div>
);

export { Property, PropertyLabel, PropertyRow, PropertyValue };
