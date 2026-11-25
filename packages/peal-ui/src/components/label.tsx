"use client";

import * as React from "react";

import { cn } from "../lib/utils";

// htmlFor is passed by name so the accessibility lint sees the association
// that callers make. A checkbox's or a switch's peer is the box around the
// control (`peer-has-disabled`), a native field's the field itself.
const Label = ({
  className,
  htmlFor,
  ...props
}: React.ComponentProps<"label">) => (
  <label
    htmlFor={htmlFor}
    data-slot="label"
    className={cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-has-disabled:cursor-not-allowed peer-has-disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export { Label };
