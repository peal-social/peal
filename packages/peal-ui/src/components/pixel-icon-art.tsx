"use client";

import { useEffect, useRef } from "react";
import type * as React from "react";

import { createPixelFlow, flowCell } from "../lib/pixel-flow";
import type { PixelFlow } from "../lib/pixel-flow";
import { rasterise } from "../lib/pixel-icon";
import { cn } from "../lib/utils";

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

// The cleanup of an effect that started nothing.
const leaveAsIs = () => null;

// The art's tones on the page's own background, dim to bright: the blue
// tint, lavender, the mark's blue, and yellow where the field crests.
const pageTones = ["--brand-tint", "--lavender", "--brand", "--sun"] as const;

// The cells across a box, when the art is to fill it: 90% of its shorter
// side.
const cellsFor = (element: HTMLElement) => {
  const { height, width } = element.getBoundingClientRect();

  return Math.max(8, Math.floor((Math.min(width, height) * 0.9) / flowCell));
};

/**
 * An icon drawn in pixels on the page (DESIGN.md, Site): rasterised onto
 * 5 px cells, toned by how full each cell is, flat. The first time it is on
 * screen it decodes from scrambled pixels, left to right; while it stays
 * there a slow field flows through its strokes, which brighten and dim in
 * bands. Still, and drawn at once, with reduced motion. Decoration: screen
 * readers skip it. The art is made once the canvas is first seen, so
 * reading the tones and the box costs no layout while the page hydrates.
 */
const PixelIconArt = ({
  art,
  cells,
  className,
  tones = pageTones,
}: {
  /** An SVG, such as a lucide icon, which the canvas rasterises. */
  readonly art: React.ReactNode;
  /** Cells across the art; by default, as many as fill the box. */
  readonly cells?: number | undefined;
  readonly className?: string | undefined;
  /** Tokens or colours, dim to bright. */
  readonly tones?: readonly [string, string, string, string] | undefined;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const svg = source.current?.querySelector("svg");

    if (element === null || !(svg instanceof SVGSVGElement)) {
      return leaveAsIs;
    }

    let made: PixelFlow | undefined;
    let begun = false;
    let seen = false;
    let cancelled = false;

    const start = async () => {
      const style = getComputedStyle(element);

      const tone = (name: string) =>
        name.startsWith("--") ? style.getPropertyValue(name).trim() : name;

      const [dim, some, full, crest] = tones;
      const icon = await rasterise(svg, cells ?? cellsFor(element));

      if (!cancelled) {
        made = createPixelFlow(element, [
          tone(dim),
          tone(some),
          tone(full),
          tone(crest),
        ]);
        made.show(icon, !reducedMotion());
        made.idle(seen && !reducedMotion());
      }
    };

    const visibility = new IntersectionObserver((entries) => {
      seen = entries.at(-1)?.isIntersecting === true;

      if (seen && !begun) {
        begun = true;
        void start();
      }

      made?.idle(seen && !reducedMotion());
    });

    visibility.observe(element);

    return () => {
      cancelled = true;
      visibility.disconnect();
      made?.dispose();
    };
  }, [cells, tones]);

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 size-full [image-rendering:pixelated]",
          className
        )}
      />
      <span ref={source} hidden>
        {art}
      </span>
    </>
  );
};

export { PixelIconArt };
