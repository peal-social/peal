"use client";

import {
  Toast as ToastPrimitive,
  ToastAction as ToastActionPrimitive,
  ToastDescription as ToastDescriptionPrimitive,
  ToastRegion as ToastRegionPrimitive,
  ToastTitle as ToastTitlePrimitive,
} from "@ui-sdk/react/toast";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import "../lib/css-properties";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

const icons = {
  error: OctagonXIcon,
  info: InfoIcon,
  loading: Loader2Icon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
};

// ui-sdk holds toasts' timers while the tab is hidden, and from a blur of
// the window (to anything but a frame of the page) to its next focus: a
// time bar holds with them, on the same events. Like ui-sdk, it does not
// read whether the window had the focus when the page started.
const useAway = (): boolean => {
  const [hidden, setHidden] = useState(false);
  const [blurred, setBlurred] = useState(false);

  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.hidden);
    };

    const onBlur = () => {
      if (document.activeElement?.tagName !== "IFRAME") {
        setBlurred(true);
      }
    };

    const onFocus = () => {
      setBlurred(false);
    };

    onVisibility();
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return hidden || blurred;
};

/**
 * Where toasts show, once near the app's root: a stack at the bottom
 * right that opens while the pointer or focus is in it. `label` names the
 * region for screen readers, in the reader's language; F6 moves focus to
 * the newest toast and back. A toast with an action shows the time it has
 * left as a bar along its foot, which holds whenever its timer does.
 */
const Toaster = ({
  label,
  pendingAnnouncement,
}: {
  readonly label: string;
  /** What screen readers hear while an action, like Undo, runs. */
  readonly pendingAnnouncement: string;
}) => {
  const away = useAway();

  return (
    <ToastRegionPrimitive
      aria-label={label}
      side="bottom"
      align="end"
      pendingAnnouncement={pendingAnnouncement}
      className="fixed right-4 bottom-4 z-[100] h-(--toast-front-height) w-[min(24rem,calc(100vw-2rem))] transition-[height] duration-300 data-[expanded]:h-[calc(var(--toast-stack-height)+(var(--toast-count)-1)*8px)]"
    >
      {(item) => {
        const Icon = item.type === "default" ? undefined : icons[item.type];

        return (
          <ToastPrimitive className="bg-popover text-popover-foreground ring-foreground/10 absolute inset-x-0 bottom-0 z-[calc(100-var(--toast-index))] flex h-(--toast-height) [translate:var(--toast-swipe-x,0px)_calc(var(--y)+var(--toast-swipe-y,0px))] [scale:calc(1-var(--toast-index)*0.05)] items-start gap-2.5 overflow-hidden rounded-lg p-3 text-sm shadow-lg ring-1 transition-[translate,scale,opacity,height] duration-300 select-none [--y:calc(var(--toast-index)*-8px)] not-data-[front]:not-data-[expanded]:h-(--toast-front-height) data-[ending-style]:opacity-0 data-[expanded]:[scale:1] data-[expanded]:[--y:calc(-1*(var(--toast-offset)+var(--toast-index)*8px))] data-[starting-style]:transition-none data-[starting-style]:not-data-[front]:opacity-0 data-[starting-style]:data-[front]:[--y:100%] data-[swiping]:transition-none motion-reduce:transition-opacity">
            {Icon === undefined ? null : (
              <Icon
                aria-hidden
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  item.type === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
                  item.type === "loading" && "animate-spin"
                )}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <ToastTitlePrimitive className="leading-5" />
              {item.description === undefined ? null : (
                <ToastDescriptionPrimitive className="text-muted-foreground leading-5" />
              )}
            </div>
            {item.action === undefined ? null : (
              <ToastActionPrimitive
                className={cn(
                  buttonVariants({ size: "xs", variant: "outline" }),
                  "-my-0.5 shrink-0 data-[pending]:opacity-60"
                )}
              />
            )}
            {item.action === undefined ? null : (
              <span
                key={item.version}
                aria-hidden
                data-slot="toast-time"
                className={cn(
                  "animate-toast-time absolute inset-x-0 bottom-0 h-0.5 bg-[linear-gradient(90deg,var(--brand),var(--lavender)_70%,var(--sun))] [animation-duration:var(--toast-duration)] in-data-[expanded]:[animation-play-state:paused] in-data-[swiping]:[animation-play-state:paused] motion-reduce:hidden",
                  away && "[animation-play-state:paused]"
                )}
                style={{ "--toast-duration": `${String(item.duration)}ms` }}
              />
            )}
          </ToastPrimitive>
        );
      }}
    </ToastRegionPrimitive>
  );
};

export { Toaster };

export { toast } from "@ui-sdk/react/toast";
