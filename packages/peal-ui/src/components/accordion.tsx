"use client";

import {
  Accordion as AccordionPrimitive,
  AccordionHeader as AccordionHeaderPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionPanel as AccordionPanelPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@ui-sdk/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

type WithClassName<Props> = Omit<Props, "className"> & {
  readonly className?: string | undefined;
};

type WithChildren<Props> = Omit<Props, "children"> & {
  readonly children?: React.ReactNode;
};

// ui-sdk's Accordion: headings whose buttons open their panels, with Tab
// between triggers and Enter or Space to toggle, as the APG pattern has it.
const Accordion = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AccordionPrimitive>>) => (
  <AccordionPrimitive className={cn("flex flex-col", className)} {...props} />
);

const AccordionItem = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof AccordionItemPrimitive>>) => (
  <AccordionItemPrimitive
    className={cn("border-b last:border-b-0", className)}
    {...props}
  />
);

// The header part's element, one level down, for a page that already has
// its third-level headings.
const Heading4 = ({ children, ...props }: React.ComponentProps<"h4">) => (
  <h4 {...props}>{children}</h4>
);

const AccordionTrigger = ({
  children,
  className,
  level = 3,
  ...props
}: WithChildren<
  WithClassName<React.ComponentProps<typeof AccordionTriggerPrimitive>>
> & {
  /** The heading level around the trigger, to fit the page's outline. */
  readonly level?: 3 | 4 | undefined;
}) => (
  <AccordionHeaderPrimitive
    className="flex"
    {...(level === 4 ? { render: Heading4 } : {})}
  >
    <AccordionTriggerPrimitive
      className={cn(
        "group/accordion-trigger text-foreground hover:bg-accent/60 focus-visible:ring-ring/50 flex flex-1 items-center justify-between gap-4 px-6 py-4 text-start text-base font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        strokeWidth={1.75}
        className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-open/accordion-trigger:rotate-180 motion-reduce:transition-none"
      />
    </AccordionTriggerPrimitive>
  </AccordionHeaderPrimitive>
);

// The panel animates its measured height, and not at all for reduced
// motion; its content sits under a hairline, in muted text.
const AccordionPanel = ({
  children,
  className,
  ...props
}: WithChildren<
  WithClassName<React.ComponentProps<typeof AccordionPanelPrimitive>>
>) => (
  <AccordionPanelPrimitive
    className={cn(
      "h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
      className
    )}
    {...props}
  >
    <div className="text-muted-foreground mx-6 border-t pt-3 pb-5 text-sm leading-relaxed">
      {children}
    </div>
  </AccordionPanelPrimitive>
);

export { Accordion, AccordionItem, AccordionPanel, AccordionTrigger };
