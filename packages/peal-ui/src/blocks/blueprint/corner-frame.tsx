import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import type * as React from "react";

import { cn } from "../../lib/utils";
import { Tick } from "./tick";

type CornerFrameProps = Omit<PartProps<"div">, "children" | "className"> & {
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
};

/**
 * A bordered frame for art or a figure (DESIGN.md, Site, Cells), with a
 * crosshair tick on each corner, as the rails' joints have.
 */
const CornerFrame = ({
  children,
  className,
  render,
  ...props
}: CornerFrameProps) =>
  renderElement(
    "div",
    {
      ...props,
      children: (
        <>
          {children}
          <Tick className="-start-px -top-px z-10" />
          <Tick className="start-full -top-px z-10" />
          <Tick className="-start-px top-full z-10" />
          <Tick className="start-full top-full z-10" />
        </>
      ),
      className: cn("relative border", className),
      "data-slot": "corner-frame",
    },
    render
  );

export { CornerFrame };

export type { CornerFrameProps };
