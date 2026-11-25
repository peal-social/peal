"use client";

import { useEffect, useRef } from "react";

import {
  cell,
  layouts,
  litCellsOf,
  momentAt,
  shadeOf,
} from "../lib/pixel-glow";
import type { Glow, LitCell, PixelGlowLayout } from "../lib/pixel-glow";
import { cn } from "../lib/utils";

// The brand field's glows drawn in pixels on the page's own background
// (DESIGN.md, Site): the social banners' blue, lavender and yellow, where
// the banners place them, rasterised onto 5 px cells and Bayer-dithered as
// the menu art and the FAQ are, fading to nothing toward the middle so the
// text stays clear. It drifts, twinkles and glows while on screen, and
// stays still with reduced motion. Decoration: screen readers skip it. Its
// geometry is in `lib/pixel-glow`; this is its canvas.

const toneOf = (style: CSSStyleDeclaration, tone: string) =>
  tone.startsWith("--") ? style.getPropertyValue(tone).trim() : tone;

// The tones of each glow of a layout, their tokens read from the canvas.
const tonesOf = (
  canvas: HTMLCanvasElement,
  glows: readonly Glow[]
): readonly (readonly string[])[] => {
  const style = getComputedStyle(canvas);

  return glows.map((glow) => glow.tones.map((tone) => toneOf(style, tone)));
};

/**
 * Draws the cells at `time`, in seconds: the texture drifts, slowly, and
 * each cell twinkles on its own beat, so the glows' edges shimmer as a
 * fire's do; a blurred copy under the crisp pixels makes them glow.
 */
const draw = (
  canvas: HTMLCanvasElement,
  pixels: HTMLCanvasElement,
  cells: readonly LitCell[],
  tones: readonly (readonly string[])[],
  time: number
) => {
  const context = canvas.getContext("2d");
  const pixelContext = pixels.getContext("2d");

  if (context === null || pixelContext === null) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const size = Math.round(cell * ratio);

  pixelContext.clearRect(0, 0, pixels.width, pixels.height);

  const moment = momentAt(time);

  for (const lit of cells) {
    const shade = shadeOf(lit, moment);

    if (shade !== null) {
      pixelContext.fillStyle = tones[lit.glow]?.[shade] ?? "";
      pixelContext.fillRect(
        Math.round(lit.column * cell * ratio),
        Math.round(lit.row * cell * ratio),
        size,
        size
      );
    }
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  // The glow: the same pixels, blurred and faint, under them.
  context.filter = `blur(${String(Math.round(6 * ratio))}px)`;
  context.globalAlpha = 0.6;
  context.drawImage(pixels, 0, 0);
  context.filter = "none";
  context.globalAlpha = 1;
  context.drawImage(pixels, 0, 0);
};

// The glow moves at this many frames a second: enough to shimmer, little
// enough to cost nothing noticeable.
const framesPerSecond = 24;

// The cleanup of an effect that started nothing.
const leaveAsIs = () => null;

const PixelGlow = ({
  className,
  layout = "band",
}: {
  readonly className?: string | undefined;
  /** Where the glows sit around the content: see `layouts`. */
  readonly layout?: PixelGlowLayout | undefined;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;

    if (element === null) {
      return leaveAsIs;
    }

    const pixels = document.createElement("canvas");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cells: LitCell[] = [];
    let tones: readonly (readonly string[])[] = [];
    let frame = 0;
    let visible = false;
    let last = 0;
    const start = performance.now();

    const paint = (now: number) => {
      draw(
        element,
        pixels,
        cells,
        tones,
        still.matches ? 0 : (now - start) / 1000
      );
    };

    const loop = (now: number) => {
      frame = 0;

      if (!visible || still.matches) {
        return;
      }

      if (now - last >= 1000 / framesPerSecond) {
        last = now;
        paint(now);
      }

      frame = requestAnimationFrame(loop);
    };

    const run = () => {
      if (frame === 0 && visible && !still.matches) {
        frame = requestAnimationFrame(loop);
      }
    };

    const resize = new ResizeObserver(() => {
      const { height, width } = element.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;

      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      pixels.width = element.width;
      pixels.height = element.height;
      cells = width === 0 ? [] : litCellsOf(width, height, layouts[layout]);
      tones = tonesOf(element, layouts[layout]);
      paint(performance.now());
    });

    // It moves only while on screen.
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      run();
    });

    resize.observe(element);
    seen.observe(element);
    still.addEventListener("change", run);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      still.removeEventListener("change", run);
    };
  }, [layout]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 size-full [image-rendering:pixelated]",
        className
      )}
    />
  );
};

export { PixelGlow };
