import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import { cn } from "../../lib/utils";

type TickProps = Omit<PartProps<"span">, "children" | "className"> & {
  /** Places the joint: the tick centres on its element's start and top. */
  readonly className?: string | undefined;
  /** In `input` on the page, or the field's white on the brand field. */
  readonly on?: "field" | "page" | undefined;
};

/**
 * The blueprint's crosshair (DESIGN.md, Site): ±5 px where two lines meet,
 * centred on the point its `className` places. Decoration only.
 */
const Tick = ({ className, on = "page", render, ...props }: TickProps) =>
  renderElement(
    "span",
    {
      ...props,
      "aria-hidden": "true",
      children: (
        <>
          <span
            className={cn(
              "absolute start-0 top-[5px] h-px w-full",
              on === "field" ? "bg-(--field-tick)" : "bg-input"
            )}
          />
          <span
            className={cn(
              "absolute start-[5px] top-0 h-full w-px",
              on === "field" ? "bg-(--field-tick)" : "bg-input"
            )}
          />
        </>
      ),
      className: cn(
        "pointer-events-none absolute -ms-[5px] -mt-[5px] size-[11px]",
        className
      ),
      "data-on": on,
      "data-slot": "tick",
    },
    render
  );

export { Tick };

export type { TickProps };
