import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import type * as React from "react";

import { cn } from "../../lib/utils";

// Written out whole, so Tailwind finds them: one column on a phone, two
// from 640 px, then as many as asked from 1024 px.
const columnClassNames = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
} as const;

type CellGridProps = Omit<PartProps<"div">, "children" | "className"> & {
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
  readonly columns?: keyof typeof columnClassNames | undefined;
};

/**
 * Bordered cells side by side (DESIGN.md, Site), as tall as each other,
 * one column on a phone. Each cell draws its border as a 1 px outline into
 * the gap, so neighbours share one line, the outer ones fall on the rails
 * and on the section's rule, and a short last row leaves no fill behind.
 * Pass `render={<ul />}` with cells rendered as `li` for a list.
 */
const CellGrid = ({
  children,
  className,
  columns = 3,
  render,
  ...props
}: CellGridProps) =>
  renderElement(
    "div",
    {
      ...props,
      children,
      className: cn(
        "grid gap-px px-px not-first:mt-px",
        columnClassNames[columns],
        className
      ),
      "data-columns": columns,
      "data-slot": "cell-grid",
    },
    render
  );

export { CellGrid };

export type { CellGridProps };
