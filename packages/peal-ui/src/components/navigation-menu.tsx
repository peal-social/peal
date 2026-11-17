"use client";

import {
  NavigationMenu as NavigationMenuPrimitive,
  NavigationMenuContent as NavigationMenuContentPrimitive,
  NavigationMenuItem as NavigationMenuItemPrimitive,
  NavigationMenuLink as NavigationMenuLinkPrimitive,
  NavigationMenuList as NavigationMenuListPrimitive,
  NavigationMenuTrigger as NavigationMenuTriggerPrimitive,
  NavigationMenuViewport as NavigationMenuViewportPrimitive,
} from "@ui-sdk/react/navigation-menu";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

type WithClassName<Props> = Omit<Props, "className"> & {
  readonly className?: string | undefined;
};

type WithChildren<Props> = Omit<Props, "children"> & {
  readonly children?: React.ReactNode;
};

// ui-sdk's NavigationMenu: the disclosure pattern for a site's main links,
// with one floating viewport that takes the open panel's size.
const NavigationMenu = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NavigationMenuPrimitive>>) => (
  <NavigationMenuPrimitive
    className={cn("relative flex items-center", className)}
    {...props}
  />
);

const NavigationMenuList = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NavigationMenuListPrimitive>>) => (
  <NavigationMenuListPrimitive
    className={cn("flex items-center gap-0.5", className)}
    {...props}
  />
);

const NavigationMenuItem = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NavigationMenuItemPrimitive>>) => (
  <NavigationMenuItemPrimitive
    className={cn("relative", className)}
    {...props}
  />
);

const navigationMenuTriggerClassName =
  "group/navigation-menu-trigger text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 data-open:bg-accent data-open:text-foreground data-current:text-foreground inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const NavigationMenuTrigger = ({
  className,
  children,
  ...props
}: WithChildren<
  WithClassName<React.ComponentProps<typeof NavigationMenuTriggerPrimitive>>
>) => (
  <NavigationMenuTriggerPrimitive
    className={cn(navigationMenuTriggerClassName, className)}
    {...props}
  >
    {children}
    <ChevronDownIcon
      aria-hidden="true"
      strokeWidth={1.75}
      className="size-3.5 transition-transform duration-200 group-data-open/navigation-menu-trigger:rotate-180 motion-reduce:transition-none"
    />
  </NavigationMenuTriggerPrimitive>
);

// Placed at the viewport's corner with its own width, so the viewport takes
// its size, and slid in from the side of the item it replaces.
const NavigationMenuContent = ({
  className,
  ...props
}: WithClassName<
  React.ComponentProps<typeof NavigationMenuContentPrimitive>
>) => (
  <NavigationMenuContentPrimitive
    className={cn(
      "absolute start-0 top-0 w-max p-2 transition-[opacity,translate] duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 data-[motion=from-end]:data-starting-style:translate-x-12 data-[motion=from-start]:data-starting-style:-translate-x-12 data-[motion=to-end]:data-ending-style:translate-x-12 data-[motion=to-start]:data-ending-style:-translate-x-12 motion-reduce:transition-none",
      className
    )}
    {...props}
  />
);

const NavigationMenuViewport = ({
  className,
  sideOffset = 8,
  collisionPadding = 16,
  ...props
}: WithClassName<
  React.ComponentProps<typeof NavigationMenuViewportPrimitive>
>) => (
  <NavigationMenuViewportPrimitive
    sideOffset={sideOffset}
    collisionPadding={collisionPadding}
    className={cn(
      "bg-popover text-popover-foreground ring-foreground/10 z-50 h-(--viewport-height) w-(--viewport-width) origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 transition-[width,height,left,top,opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
      className
    )}
    {...props}
  />
);

const NavigationMenuLink = ({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NavigationMenuLinkPrimitive>>) => (
  <NavigationMenuLinkPrimitive
    className={cn(
      "hover:bg-accent focus-visible:ring-ring/50 data-current:bg-accent flex gap-3 rounded-md p-2 text-sm transition-colors outline-none focus-visible:ring-3",
      className
    )}
    {...props}
  />
);

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerClassName,
};
