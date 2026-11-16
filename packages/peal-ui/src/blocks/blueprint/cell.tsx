import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import type * as React from "react";

import { cn } from "../../lib/utils";

// Written out whole, so Tailwind finds them; a wide cell is one column on a
// phone and at most two from 640 px.
const spanClassNames = {
  1: undefined,
  2: "sm:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
} as const;

const surfaceClassNames = {
  background: "bg-background",
  card: "bg-card",
  hatch: "bg-background bg-(image:--hatch)",
  muted: "bg-muted",
} as const;

type CellProps = Omit<PartProps<"div">, "children" | "className"> & {
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
  /** How many of the grid's columns the cell takes. */
  readonly span?: keyof typeof spanClassNames | undefined;
  /**
   * Its surface (DESIGN.md, Site, Cells). A hatched cell only holds the
   * grid's shape: it shows nothing, and screen readers skip it.
   */
  readonly surface?: keyof typeof surfaceClassNames | undefined;
};

/** One bordered cell of a `CellGrid`. */
const Cell = ({
  children,
  className,
  render,
  span = 1,
  surface = "background",
  ...props
}: CellProps) =>
  renderElement(
    "div",
    {
      ...props,
      "aria-hidden": surface === "hatch" ? "true" : undefined,
      children: surface === "hatch" ? undefined : children,
      className: cn(
        "outline-border min-w-0 p-6 outline",
        surfaceClassNames[surface],
        spanClassNames[span],
        className
      ),
      "data-slot": "cell",
      "data-surface": surface,
    },
    render
  );

export { Cell };

export type { CellProps };
