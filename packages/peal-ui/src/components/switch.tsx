"use client";

import { Switch as SwitchPrimitive, SwitchThumb } from "@ui-sdk/react/switch";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * A setting that takes effect as soon as it changes (DESIGN.md,
 * "`switch`"): a 32 by 18 px track, `input` when off and ink when on,
 * its white thumb sliding to the end. Its label says what the setting is
 * and stays the same either way.
 *
 * ui-sdk renders the switch's native input after the control, absolutely
 * positioned: the `switch-control` box around both keeps it inside the
 * control's box (see `Checkbox`), and is the `peer` a following label
 * reads. `className` still styles the control.
 */
const Switch = ({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof SwitchPrimitive>,
  "children" | "className"
> & {
  readonly className?: string | undefined;
}) => (
  <span
    data-slot="switch-control"
    className="peer relative inline-flex size-fit shrink-0"
  >
    <SwitchPrimitive
      data-slot="switch"
      className={cn(
        "bg-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:bg-primary relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 aria-invalid:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchThumb
        data-slot="switch-thumb"
        className="bg-background pointer-events-none block size-4 rounded-full shadow-sm ring-0 transition-transform data-checked:translate-x-[14px] data-unchecked:translate-x-0"
      />
    </SwitchPrimitive>
  </span>
);

export { Switch };
