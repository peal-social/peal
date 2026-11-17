"use client";

import { useEffect, useRef } from "react";

import { cn } from "../lib/utils";

// A faint field of pixels behind a section's opener (DESIGN.md, Site):
// 5 px cells where smooth noise rises, in the blue and lavender tints,
// thinning toward the middle so the headline stays clear. Still, and
// decoration: screen readers skip it.

const cell = 5;

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.5453;

  return value - Math.floor(value);
};

const smooth = (t: number) => t * t * (3 - 2 * t);

// Value noise: hashed corners, blended smoothly.
const noise = (x: number, y: number) => {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const u = smooth(x - left);
  const v = smooth(y - top);
  const a = hash(left, top);
  const b = hash(left + 1, top);
  const c = hash(left, top + 1);
  const d = hash(left + 1, top + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

const draw = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d");
  const { height, width } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);

  if (context === null) {
    return;
  }

  const style = getComputedStyle(canvas);
  // The blue tint, and the lavender tint of DESIGN.md's pairs.
  const tones = [style.getPropertyValue("--brand-tint").trim(), "#ede7ff"];
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      // Thinner toward the centre, where the headline is.
      const away = Math.abs(column / columns - 0.5) * 2;

      const value =
        noise(column / 16, row / 10) * 0.6 + noise(column / 4, row / 4) * 0.4;

      const level = value * (0.45 + 0.75 * away);
      const dither = ((bayer[(row % 4) * 4 + (column % 4)] ?? 0) + 0.5) / 16;

      if (level > 0.66 + dither * 0.22) {
        context.fillStyle = (level > 0.8 ? tones[1] : tones[0]) ?? "#e8ecfd";
        context.fillRect(
          Math.round(column * cell * ratio),
          Math.round(row * cell * ratio),
          Math.round(cell * ratio),
          Math.round(cell * ratio)
        );
      }
    }
  }
};

const PixelField = ({
  className,
}: {
  readonly className?: string | undefined;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;

    const observer = new ResizeObserver(() => {
      if (element !== null) {
        draw(element);
      }
    });

    if (element !== null) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 size-full [image-rendering:pixelated]",
        className
      )}
    />
  );
};

export { PixelField };
