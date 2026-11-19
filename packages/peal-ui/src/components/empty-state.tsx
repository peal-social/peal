"use client";

import type * as React from "react";

import { cn } from "../lib/utils";
import { PixelFigure } from "./pixel-figure";

// The pixel icon's tones, dim to bright: the blue and lavender tints, then
// lavender, with blue on the brightest cells (DESIGN.md, "Empty states").
const tones = ["--brand-tint", "#EDE7FF", "--lavender", "--brand"] as const;

/**
 * What a list, a page or a pane shows when it has nothing (DESIGN.md,
 * "Empty states"): in its centre, the page's icon in pixels, a title, a
 * line or two, and the next step.
 */
const EmptyState = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    data-slot="empty-state"
    className={cn(
      "mx-auto flex min-h-[calc(100svh-14rem)] w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center",
      className
    )}
    {...props}
  />
);

/**
 * The page's icon as still pixel art, 80 px square: `icon` is an SVG, such
 * as a lucide icon. Screen readers skip it.
 */
const EmptyStateIcon = ({ icon }: { readonly icon: React.ReactNode }) => (
  <PixelFigure art={icon} className="mb-2 size-20" tones={[...tones]} />
);

const EmptyStateTitle = ({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"h2">, "children"> & {
  readonly children: React.ReactNode;
}) => (
  <h2
    data-slot="empty-state-title"
    className={cn("text-[15px] font-semibold", className)}
    {...props}
  >
    {children}
  </h2>
);

const EmptyStateDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">) => (
  <p
    data-slot="empty-state-description"
    className={cn(
      "text-muted-foreground max-w-[28rem] text-sm text-balance",
      className
    )}
    {...props}
  />
);

/** The next step, and at most one other: a primary and an outline button. */
const EmptyStateActions = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="empty-state-actions"
    className={cn("mt-2 flex flex-wrap justify-center gap-2", className)}
    {...props}
  />
);

/**
 * How many items the filters hide, in a bordered strip, with the way to
 * show them at its end ("12 posts hidden by the filters · Clear").
 */
const EmptyStateHidden = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    data-slot="empty-state-hidden"
    className={cn(
      "text-muted-foreground [&_strong]:text-foreground mt-2 flex items-center gap-4 rounded-lg border px-4 py-2.5 text-sm [&_strong]:font-medium",
      className
    )}
    {...props}
  />
);

export {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateHidden,
  EmptyStateIcon,
  EmptyStateTitle,
};
