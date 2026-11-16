import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import type * as React from "react";

import { cn } from "../../lib/utils";
import { Tick } from "./tick";

type SectionProps = Omit<
  PartProps<"section">,
  "aria-labelledby" | "children" | "className"
> & {
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
  /** The id of the section's heading, which names it as a region. */
  readonly labelledBy?: string | undefined;
  /** Where full-width rules cross the rails: above, above and below, or none. */
  readonly rule?: "both" | "none" | "top" | undefined;
};

// Where a rule meets the two rails: the rule is the section's own border, a
// pixel outside its content box, and the right rail the column's last pixel.
const Joints = ({ edge }: { readonly edge: "bottom" | "top" }) => (
  <>
    <Tick
      className={cn("start-0 z-10", edge === "top" ? "-top-px" : "top-full")}
    />
    <Tick
      className={cn(
        "start-[calc(100%-1px)] z-10",
        edge === "top" ? "-top-px" : "top-full"
      )}
    />
  </>
);

/**
 * A site section on the blueprint (DESIGN.md, Site): a full-width rule with
 * a tick where it meets each rail, then the 72 rem column its content sits
 * in.
 */
const Section = ({
  children,
  className,
  labelledBy,
  render,
  rule = "top",
  ...props
}: SectionProps) =>
  renderElement(
    "section",
    {
      ...props,
      "aria-labelledby": labelledBy,
      children: (
        <div className="relative mx-auto max-w-6xl">
          {rule === "none" ? null : <Joints edge="top" />}
          {children}
          {rule === "both" ? <Joints edge="bottom" /> : null}
        </div>
      ),
      className: cn(
        "relative scroll-mt-8",
        rule === "none" ? undefined : "border-t",
        rule === "both" ? "border-b" : undefined,
        className
      ),
      "data-rule": rule,
      "data-slot": "section",
    },
    render
  );

export { Section };

export type { SectionProps };
