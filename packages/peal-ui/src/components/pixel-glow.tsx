"use client";

import { useEffect, useRef } from "react";

import { cn } from "../lib/utils";

// The brand field's glows drawn in pixels on the page's own background
// (DESIGN.md, Site): the social banners' blue, lavender and yellow, where
// the banners place them, rasterised onto 5 px cells and Bayer-dithered as
// the menu art and the FAQ are, fading to nothing toward the middle so the
// text stays clear. It drifts, twinkles and glows while on screen, and
// stays still with reduced motion. Decoration: screen readers skip it.

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

/**
 * One glow: its centre as a fraction of the band, its reach as a fraction
 * of the band's width, and its tones from strongest to faintest (tokens
 * or colours).
 */
interface Glow {
  readonly radius: number;
  readonly tones: readonly [string, string, string];
  readonly x: number;
  readonly y: number;
}

const blue = ["--brand", "--lavender", "--brand-tint"] as const;

const lavender = ["--lavender", "#d5c9ff", "#ede7ff"] as const;

const yellow = ["--sun", "#ffe27a", "#fff4c7"] as const;

/**
 * Where the glows sit. `band`, the banners' own layout around centred
 * text: blue from the left, lavender at the top right, yellow low at the
 * right. `hero`, around a headline on the left: blue and lavender in the
 * top right, above the lead, yellow low at the right and a little lavender
 * low at the left, so the headline and its buttons stay on the plain page.
 */
const layouts = {
  band: [
    { radius: 0.34, tones: blue, x: 0, y: 0.3 },
    { radius: 0.28, tones: lavender, x: 1, y: 0 },
    { radius: 0.2, tones: yellow, x: 0.97, y: 1 },
  ],
  hero: [
    { radius: 0.26, tones: blue, x: 0.84, y: -0.04 },
    { radius: 0.22, tones: lavender, x: 1, y: 0.14 },
    { radius: 0.17, tones: yellow, x: 0.98, y: 1.02 },
    { radius: 0.14, tones: lavender, x: 0, y: 1 },
  ],
} as const satisfies Record<string, readonly Glow[]>;

type PixelGlowLayout = keyof typeof layouts;

// The level above which each tone shows, strongest first.
const steps = [0.5, 0.26, 0] as const;

// Never fully solid: the brightest cells still leave a gap one in eight,
// so a glow's heart reads as pixels too.
const ceiling = 0.72;

const toneOf = (style: CSSStyleDeclaration, tone: string) =>
  tone.startsWith("--") ? style.getPropertyValue(tone).trim() : tone;

/** A cell some glow reaches: what never changes about it, worked out once. */
interface LitCell {
  readonly column: number;
  readonly dither: number;
  /** How near the glow's heart it sits, 0 at its edge to 1 at its heart. */
  readonly reach: number;
  readonly row: number;
  /** Its own beat, so the cells do not twinkle together. */
  readonly phase: number;
  readonly tones: readonly string[];
}

/** The cells of the canvas that any glow reaches, for its size. */
const litCellsOf = (
  canvas: HTMLCanvasElement,
  glows: readonly Glow[]
): LitCell[] => {
  const { height, width } = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);

  const tones = glows.map((glow) =>
    glow.tones.map((tone) => toneOf(style, tone))
  );

  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cells: LitCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * cell;
      const y = row * cell;

      // The strongest glow at this cell, and how near its heart.
      let reach = 0;
      let strongest = 0;

      for (const [index, glow] of glows.entries()) {
        const distance =
          Math.hypot(x - glow.x * width, y - glow.y * height) /
          (glow.radius * width);

        const near = distance < 1 ? (1 - distance) ** 2 : 0;

        if (near > reach) {
          reach = near;
          strongest = index;
        }
      }

      if (reach > 0.02) {
        cells.push({
          column,
          dither: ((bayer[(row % 4) * 4 + (column % 4)] ?? 0) + 0.5) / 16,
          phase: hash(column, row) * Math.PI * 2,
          reach,
          row,
          tones: tones[strongest] ?? [],
        });
      }
    }
  }

  return cells;
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

  for (const lit of cells) {
    const texture =
      0.7 +
      0.6 *
        (noise(lit.column / 14 + time * 0.12, lit.row / 9 + time * 0.05) * 0.7 +
          noise(lit.column / 4 - time * 0.35, lit.row / 4 + time * 0.2) * 0.3);

    const twinkle = 0.12 * Math.sin(time * 2.4 + lit.phase);
    const level = Math.min(ceiling, lit.reach * (texture + twinkle));

    if (level > 0.06 + lit.dither * 0.75) {
      // The strongest tone near the glow's heart, the faintest at its
      // edge, dithered where two tones meet.
      const shaded = level + (lit.dither - 0.5) * 0.2;
      const shade = steps.findIndex((step) => shaded > step);

      pixelContext.fillStyle = lit.tones[shade] ?? "";
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
    let frame = 0;
    let visible = false;
    let last = 0;
    const start = performance.now();

    const paint = (now: number) => {
      draw(element, pixels, cells, still.matches ? 0 : (now - start) / 1000);
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
      cells = width === 0 ? [] : litCellsOf(element, layouts[layout]);
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

export type { PixelGlowLayout };
