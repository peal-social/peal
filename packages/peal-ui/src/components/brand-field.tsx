import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";
import { useId } from "react";
import type * as React from "react";

import { cn } from "../lib/utils";

// Each glow reads its eight --field-<glow>-* tokens. The class names are
// written out whole, so Tailwind finds them.
const glows = [
  {
    className:
      "left-(--field-blue-x) top-(--field-blue-y) h-[calc(var(--m)*var(--field-blue-height))] w-[calc(var(--m)*var(--field-blue-width))] bg-(--field-blue-colour) opacity-(--field-blue-opacity) blur-[calc(var(--m)*var(--field-blue-blur))] [mix-blend-mode:var(--field-blue-blend)]",
    name: "blue",
  },
  {
    className:
      "left-(--field-lavender-x) top-(--field-lavender-y) h-[calc(var(--m)*var(--field-lavender-height))] w-[calc(var(--m)*var(--field-lavender-width))] bg-(--field-lavender-colour) opacity-(--field-lavender-opacity) blur-[calc(var(--m)*var(--field-lavender-blur))] [mix-blend-mode:var(--field-lavender-blend)]",
    name: "lavender",
  },
  {
    className:
      "left-(--field-lavender-deep-x) top-(--field-lavender-deep-y) h-[calc(var(--m)*var(--field-lavender-deep-height))] w-[calc(var(--m)*var(--field-lavender-deep-width))] bg-(--field-lavender-deep-colour) opacity-(--field-lavender-deep-opacity) blur-[calc(var(--m)*var(--field-lavender-deep-blur))] [mix-blend-mode:var(--field-lavender-deep-blend)]",
    name: "lavender-deep",
  },
  {
    className:
      "left-(--field-halo-x) top-(--field-halo-y) h-[calc(var(--m)*var(--field-halo-height))] w-[calc(var(--m)*var(--field-halo-width))] bg-(--field-halo-colour) opacity-(--field-halo-opacity) blur-[calc(var(--m)*var(--field-halo-blur))] [mix-blend-mode:var(--field-halo-blend)]",
    name: "halo",
  },
  {
    className:
      "left-(--field-sun-x) top-(--field-sun-y) h-[calc(var(--m)*var(--field-sun-height))] w-[calc(var(--m)*var(--field-sun-width))] bg-(--field-sun-colour) opacity-(--field-sun-opacity) blur-[calc(var(--m)*var(--field-sun-blur))] [mix-blend-mode:var(--field-sun-blend)]",
    name: "sun",
  },
] as const;

// A crosshair where two rails cross, centred on the joint.
const Tick = ({ className }: { readonly className: string }) => (
  <span className={cn("absolute -ms-[5px] -mt-[5px] size-[11px]", className)}>
    <span className="absolute start-0 top-[5px] h-px w-full bg-(--field-tick)" />
    <span className="absolute start-[5px] top-0 h-full w-px bg-(--field-tick)" />
  </span>
);

type BrandFieldProps = Omit<PartProps<"div">, "children" | "className"> & {
  /** Mono captions under the lower rail, at its start and its end. */
  readonly captions?:
    | { readonly end?: string | undefined; readonly start?: string | undefined }
    | undefined;
  readonly children?: React.ReactNode;
  readonly className?: string | undefined;
  /** Whether the drafting rails cross the field. */
  readonly rails?: boolean | undefined;
  /**
   * Places the box the rails run along: by default 13% and 87% of the width
   * and 14% and 86% of the height, as the social banners have them.
   */
  readonly railsClassName?: string | undefined;
};

/**
 * The brand field (DESIGN.md): the social banners' gradient, with its
 * glows, grain, drafting rails and captions, behind white content. For the
 * site's hero, a closing call-to-action band, and covers.
 */
const BrandField = ({
  captions,
  children,
  className,
  rails = true,
  railsClassName,
  render,
  ...props
}: BrandFieldProps) => {
  const grain = useId();

  return renderElement(
    "div",
    {
      ...props,
      children: (
        <>
          {/* The glows and the grain paint into one layer of their own
              (will-change), once: painted with the page, WebKit blurred
              them again for every tile scrolled into view, a frame of 90
              to 150 ms each time. One layer, and not one per glow, so the
              compositor never blurs them itself, which a GPU-less browser
              does every frame. It looks the same, pixel for pixel. */}
          <div
            aria-hidden="true"
            className="[container-type:size] pointer-events-none absolute inset-0 -z-10 overflow-hidden will-change-transform [--m:max(100cqw,220cqh)]"
          >
            {glows.map((glow) => (
              <span
                key={glow.name}
                data-glow={glow.name}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
                  glow.className
                )}
              />
            ))}
            <svg className="absolute inset-0 size-full opacity-(--field-grain-opacity) mix-blend-soft-light">
              <filter id={grain}>
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="1.1"
                  numOctaves={3}
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <rect width="100%" height="100%" filter={`url(#${grain})`} />
            </svg>
          </div>
          {rails ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
            >
              <div
                className={cn(
                  "absolute inset-x-[13%] inset-y-[14%]",
                  railsClassName
                )}
              >
                <span className="absolute -inset-y-[100vmax] start-0 w-px bg-(--field-rail)" />
                <span className="absolute -inset-y-[100vmax] start-full w-px bg-(--field-rail)" />
                <span className="absolute -inset-x-[100vmax] top-0 h-px bg-(--field-rail)" />
                <span className="absolute -inset-x-[100vmax] top-full h-px bg-(--field-rail)" />
                <Tick className="start-0 top-0" />
                <Tick className="start-full top-0" />
                <Tick className="start-0 top-full" />
                <Tick className="start-full top-full" />
                {captions?.start === undefined ? null : (
                  <span className="absolute start-2 top-full mt-2 font-mono text-xs tracking-[0.04em] text-(--field-caption) lowercase">
                    {captions.start}
                  </span>
                )}
                {captions?.end === undefined ? null : (
                  <span className="absolute end-2 top-full mt-2 font-mono text-xs tracking-[0.04em] text-(--field-caption) lowercase">
                    {captions.end}
                  </span>
                )}
              </div>
            </div>
          ) : null}
          {children}
        </>
      ),
      className: cn(
        "relative isolate overflow-hidden bg-(image:--field-base) text-(--field-foreground)",
        className
      ),
      "data-slot": "brand-field",
    },
    render
  );
};

export { BrandField };

export type { BrandFieldProps };
