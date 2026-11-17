"use client";

import { useEffect, useRef } from "react";
import type * as React from "react";

import { createPixelArt, rasterise } from "../lib/pixel-icon";
import type { PixelPalette } from "../lib/pixel-icon";
import { cn } from "../lib/utils";

/**
 * An SVG drawn as still pixel art (DESIGN.md, Site): rasterised onto 5 px
 * cells as tall as the box allows, in four tones, as a texture behind a
 * label. Decoration: screen readers skip it.
 */
const PixelFigure = ({
  art,
  className,
  tones,
}: {
  /** An SVG, such as a lucide icon, whose shapes become the pixels. */
  readonly art: React.ReactNode;
  readonly className?: string | undefined;
  /**
   * The four colours, dim to bright, by how much of a cell is covered: CSS
   * colours or tokens' names, such as `--lavender`.
   */
  readonly tones: PixelPalette["tones"];
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLSpanElement>(null);
  const [dim, soft, strong, bright] = tones;

  useEffect(() => {
    const start = (element: HTMLCanvasElement, svg: SVGSVGElement) => {
      // A tone may name a token, such as `--lavender`, read from the page.
      const style = getComputedStyle(element);

      const colour = (tone: string) =>
        tone.startsWith("--") ? style.getPropertyValue(tone).trim() : tone;

      const pixels = createPixelArt(element, {
        tones: [colour(dim), colour(soft), colour(strong), colour(bright)],
      });

      const { height, width } = element.getBoundingClientRect();

      const cells = Math.max(
        8,
        Math.floor((Math.min(width, height) / 5) * 0.9)
      );

      let cancelled = false;

      void rasterise(svg, cells).then((icon) => {
        if (!cancelled) {
          pixels.show(icon, false);
        }

        return icon;
      });

      return () => {
        cancelled = true;
        pixels.dispose();
      };
    };

    const svg = source.current?.querySelector("svg");

    return canvas.current === null || !(svg instanceof SVGSVGElement)
      ? undefined
      : start(canvas.current, svg);
  }, [bright, dim, soft, strong]);

  return (
    <span aria-hidden="true" className={cn("relative block", className)}>
      <canvas
        ref={canvas}
        className="absolute inset-0 size-full [image-rendering:pixelated]"
      />
      <span ref={source} hidden>
        {art}
      </span>
    </span>
  );
};

export { PixelFigure };
