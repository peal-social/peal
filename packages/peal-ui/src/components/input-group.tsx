"use client";

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";
import { Input } from "./input";

const InputGroup = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="input-group"
    className={cn(
      "group/input-group border-input has-disabled:bg-input/50 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 relative flex h-8.5 w-full min-w-0 items-center overflow-hidden rounded-lg border transition-colors outline-none has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=inline-end][data-variant=plain]]:[&>input]:pr-1.5 has-[>[data-align=inline-start][data-variant=plain]]:[&>input]:pl-1.5",
      className
    )}
    {...props}
  />
);

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium select-none group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      align: "inline-start",
    },
    compoundVariants: [
      {
        align: "inline-start",
        className: "rounded-l-[inherit] border-r",
        variant: "segment",
      },
      {
        align: "inline-end",
        className: "rounded-r-[inherit] border-l",
        variant: "segment",
      },
    ],
    variants: {
      align: {
        "inline-end": "order-last pr-2.5",
        "inline-start": "order-first pl-2.5",
      },
      // `segment`: a part of the field of its own, on the muted
      // background behind a hairline, as a URL's fixed start.
      variant: {
        plain: "",
        segment: "bg-muted border-input self-stretch px-2.5 py-0",
      },
    },
  }
);

const InputGroupAddon = ({
  align = "inline-start",
  className,
  variant = "plain",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof inputGroupAddonVariants>) => (
  <div
    data-slot="input-group-addon"
    data-align={align}
    data-variant={variant}
    className={cn(inputGroupAddonVariants({ align, variant }), className)}
    {...props}
  />
);

const InputGroupText = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    className={cn(
      "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
);

const InputGroupInput = ({
  className,
  ...props
}: React.ComponentProps<typeof Input>) => (
  <Input
    data-slot="input-group-control"
    className={cn(
      "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0",
      className
    )}
    {...props}
  />
);

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText };
