"use client";

import {
  Checkbox as CheckboxPrimitive,
  CheckboxIndicator,
} from "@ui-sdk/react/checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * ui-sdk renders the checkbox's native input, which the form submits, after
 * the control and absolutely positioned. The `checkbox-control` box around
 * both is its positioning context, so the input stays inside the control's
 * box: without it, the input is laid out against a distant ancestor, and
 * below the fold of a scrolling panel it stretches the document. The box is
 * the `peer` a following label reads; `className` still styles the control.
 * A box that stands for several (`checked="indeterminate"`, some of them
 * ticked) shows a dash.
 */
const Checkbox = ({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof CheckboxPrimitive>,
  "children" | "className"
> & {
  readonly className?: string | undefined;
}) => (
  <span
    data-slot="checkbox-control"
    className="peer relative flex size-fit shrink-0"
  >
    <CheckboxPrimitive
      className={cn(
        "border-input group-has-[:focus-visible]/field-label:not-data-checked:border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3",
        className
      )}
      {...props}
    >
      <CheckboxIndicator className="grid place-content-center text-current transition-none [&>svg]:size-3.5">
        {(state) => (state.indeterminate ? <MinusIcon /> : <CheckIcon />)}
      </CheckboxIndicator>
    </CheckboxPrimitive>
  </span>
);

export { Checkbox };
