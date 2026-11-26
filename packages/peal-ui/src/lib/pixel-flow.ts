// The page's own pixel art (DESIGN.md, Site), the FAQ's and the product
// tiles': an icon's SVG rasterised onto 5 px cells and drawn as square
// pixels on a 2D canvas, toned by how full each cell is (the blue tint,
// lavender, the mark's blue, yellow at a crest). Flat: no glow. While it is
// on screen a field flows through it, two slow waves crossing, so its
// strokes brighten and dim in bands, the dithered edges of the bands shift
// as streaming data does, and a few pixels come and go around the strokes
// where the field peaks; the first time it shows, it decodes from
// scrambled pixels, left to right. No WebGL.
import type { PixelIcon } from "./pixel-icon";

/** A pixel's side, in CSS pixels, as the hero art's. */
export const flowCell = 5;

/** The tones a pixel may take: none, then the four colours, dim to bright. */
export const flowLevels = 4;

// How far the field brightens a stroke at its crest, and dims it at its
// trough: less, so a stroke never fades into its surroundings.
const crestSwing = 1.1;

const troughSwing = 0.55;

// The pixels around the strokes: only a share of the cells near them may
// light, a step above the field's middle, so they read as specks at the
// strokes' edges, never as a fill.
const speckShare = 0.35;

const speckFloor = 0.45;

const speckGain = 5;

// Below this coverage, a cell is the icon's surroundings, not its stroke.
const bare = 0.06;

// An icon's thin strokes cover their cells in part: a stroke is drawn as
// full from this much coverage.
const solid = 0.55;

// How far the dither moves a level, so the bands' edges mix two tones.
const ditherSpread = 0.5;

// How many times a second the dither pattern shifts, so the bands' edges
// change while their cores hold.
const churn = 3;

// How long a cell scrambles before it settles, as a share of the decode.
const scrambleSpan = 0.18;

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A cell's ordered-dither threshold, from 0 to 1. */
export const threshold = (column: number, row: number) =>
  ((bayer[(row % 4) * 4 + (column % 4)] ?? 0) + 0.5) / 16;

/** A fixed number from 0 to 1 for a cell and a seed. */
export const scatter = (column: number, row: number, seed = 0) => {
  const value =
    Math.sin(column * 12.9898 + row * 78.233 + seed * 37.719) * 43_758.5453;

  return value - Math.floor(value);
};

/**
 * The field flowing through the art, from -1 to 1: two slow waves crossing
 * it, so it moves in bands, never cell by cell.
 */
export const flowAt = (column: number, row: number, seconds: number) =>
  (Math.sin(column * 0.32 - row * 0.2 + seconds * 1.7) +
    Math.sin(row * 0.28 + column * 0.1 - seconds * 1.15)) /
  2;

/**
 * A cell's tone, from 0 (nothing) to `flowLevels` (yellow): the icon's
 * coverage, brightened or dimmed by the field on and near its strokes and
 * dithered; off them, for a share of the cells (`speck`, the cell's own
 * number from 0 to 1), a dim pixel where the halo (how much of the icon is
 * near) meets a crest of the field.
 */
export const levelAt = (
  cover: number,
  halo: number,
  flow: number,
  dither: number,
  speck: number
) => {
  const ink = Math.min(1, cover / solid);
  const spread = (dither - 0.5) * ditherSpread;

  if (cover > bare) {
    const swing = flow > 0 ? crestSwing : troughSwing;
    const value = ink * 3.15 + flow * swing * Math.min(1, ink * 3 + halo);

    return Math.max(0, Math.min(flowLevels, Math.floor(value + spread)));
  }

  if (speck >= speckShare) {
    return 0;
  }

  const value = halo * speckGain * Math.max(0, flow - speckFloor);

  return Math.max(0, Math.min(2, Math.floor(value + spread)));
};

/**
 * Where a cell is in the decode, at a share of it from 0 to 1: still blank,
 * scrambling, or settled. Cells settle left to right, a little apart.
 */
export const decodeAt = (
  column: number,
  row: number,
  columns: number,
  progress: number
) => {
  const settles =
    (column / Math.max(1, columns - 1)) * (1 - scrambleSpan - 0.1) +
    scrambleSpan +
    scatter(column, row, 3) * 0.1;

  if (progress >= settles) {
    return "settled";
  }

  return progress >= settles - scrambleSpan ? "scrambling" : "blank";
};

/**
 * How much of the icon is near each cell, from 0 to 1: its coverage
 * averaged over the five cells around it each way.
 */
export const haloOf = (cover: Float32Array, columns: number, rows: number) => {
  const halo = new Float32Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let sum = 0;

      for (let y = row - 2; y <= row + 2; y += 1) {
        for (let x = column - 2; x <= column + 2; x += 1) {
          const inside = x >= 0 && y >= 0 && x < columns && y < rows;

          sum += inside ? (cover[y * columns + x] ?? 0) : 0;
        }
      }

      halo[row * columns + column] = sum / 25;
    }
  }

  return halo;
};

export interface PixelFlow {
  /** Draws the icon, at once, or decoding from scrambled pixels. */
  readonly show: (icon: PixelIcon, animate: boolean) => void;
  /** Starts or stops the field's flow. */
  readonly idle: (running: boolean) => void;
  readonly dispose: () => void;
}

const decodeMs = 900;

const frameMs = 1000 / 24;

export const createPixelFlow = (
  canvas: HTMLCanvasElement,
  tones: readonly [string, string, string, string]
): PixelFlow => {
  const context = canvas.getContext("2d");
  let icon: PixelIcon | undefined;
  let cover = new Float32Array(0);
  let halo = new Float32Array(0);
  let columns = 0;
  let rows = 0;
  let ratio = 1;
  let started = 0;
  let decoding = false;
  let idling = false;
  let frame = 0;
  let drawn = Number.NEGATIVE_INFINITY;

  // The icon, centred on the canvas's grid, and its halo.
  const place = () => {
    cover = new Float32Array(columns * rows);

    if (icon !== undefined) {
      const left = Math.floor((columns - icon.columns) / 2);
      const top = Math.floor((rows - icon.rows) / 2);

      for (let y = 0; y < icon.rows; y += 1) {
        for (let x = 0; x < icon.columns; x += 1) {
          const column = left + x;
          const row = top + y;

          if (column >= 0 && row >= 0 && column < columns && row < rows) {
            cover[row * columns + column] =
              icon.coverage[y * icon.columns + x] ?? 0;
          }
        }
      }
    }

    halo = haloOf(cover, columns, rows);
  };

  // A cell's tone in this frame, from 0 (nothing) to 4.
  const cellLevel = (
    column: number,
    row: number,
    seconds: number,
    progress: number,
    tick: number
  ) => {
    const index = row * columns + column;
    const covered = cover[index] ?? 0;
    const near = halo[index] ?? 0;
    const stage = decoding ? decodeAt(column, row, columns, progress) : "";

    if (stage === "blank" || (covered <= bare && near <= 0.02)) {
      return 0;
    }

    if (stage === "scrambling") {
      return 1 + Math.floor(scatter(column, row, tick) * (flowLevels - 1));
    }

    const shift = idling ? Math.floor(seconds * churn) : 0;
    const flow = idling ? flowAt(column, row, seconds) : 0;
    const dither = threshold(column + shift, row + shift * 3);

    return levelAt(covered, near, flow, dither, scatter(column, row, 5));
  };

  const draw = (now: number) => {
    if (context === null) {
      return;
    }

    const seconds = idling ? now / 1000 : 0;
    const progress = decoding ? (now - started) / decodeMs : 1;
    const tick = Math.floor(now / frameMs);
    const side = Math.round(flowCell * ratio);

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const level = cellLevel(column, row, seconds, progress, tick);

        if (level > 0) {
          context.fillStyle = tones[level - 1] ?? tones[0];
          context.fillRect(
            Math.round(column * flowCell * ratio),
            Math.round(row * flowCell * ratio),
            side,
            side
          );
        }
      }
    }

    if (progress >= 1) {
      decoding = false;
    }
  };

  // One frame every `frameMs`, while the art decodes or flows.
  const loop = (now: number) => {
    if (now - drawn >= frameMs) {
      drawn = now;
      draw(now);
    }

    frame = decoding || idling ? requestAnimationFrame(loop) : 0;
  };

  const schedule = () => {
    if (frame === 0) {
      frame = requestAnimationFrame(loop);
    }
  };

  const resize = () => {
    const { height, width } = canvas.getBoundingClientRect();
    ratio = window.devicePixelRatio || 1;
    columns = Math.floor(width / flowCell);
    rows = Math.floor(height / flowCell);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    place();
    draw(performance.now());
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  return {
    dispose: () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    },
    idle: (running) => {
      idling = running;

      if (running) {
        schedule();
      } else {
        draw(performance.now());
      }
    },
    show: (next, animate) => {
      icon = next;
      place();
      decoding = animate;
      started = performance.now();

      if (animate) {
        schedule();
      } else {
        draw(started);
      }
    },
  };
};
