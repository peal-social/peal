// The pixel glow's geometry (DESIGN.md, Site): the brand field's glows
// rasterised onto 5 px cells and Bayer-dithered, as pure functions, with no
// canvas. The site's component draws it, and the script that makes the
// emails' art writes it to files.

/** The side of a cell, in CSS pixels. */
export const cell = 5;

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
 * One glow: its centre as a fraction of the field, its reach as a fraction
 * of the field's width, and its tones from strongest to faintest (tokens
 * or colours).
 */
export interface Glow {
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
export const layouts = {
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

export type PixelGlowLayout = keyof typeof layouts;

// The level above which each tone shows, strongest first.
const steps = [0.5, 0.26, 0] as const;

const faintest = steps.length - 1;

// Never fully solid: the brightest cells still leave a gap one in eight,
// so a glow's heart reads as pixels too.
const ceiling = 0.72;

/** A cell some glow reaches: what never changes about it, worked out once. */
export interface LitCell {
  readonly column: number;
  readonly dither: number;
  /** The glow it shows, the strongest there: its place in the layout. */
  readonly glow: number;
  /** Its own beat, so the cells do not twinkle together. */
  readonly phase: number;
  /** How near the glow's heart it sits, 0 at its edge to 1 at its heart. */
  readonly reach: number;
  readonly row: number;
}

/** The cells of a field of `width` by `height` CSS pixels any glow reaches. */
export const litCellsOf = (
  width: number,
  height: number,
  glows: readonly Glow[]
): LitCell[] => {
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
          glow: strongest,
          phase: hash(column, row) * Math.PI * 2,
          reach,
          row,
        });
      }
    }
  }

  return cells;
};

/** Where the glow is in its motion. */
export interface GlowMoment {
  /** How far the cells' twinkle has turned, in radians. */
  readonly beat: number;
  /** Where the fine layer of noise has drifted to, in its own cells. */
  readonly fast: readonly [number, number];
  /** Where the broad one has. */
  readonly slow: readonly [number, number];
}

// What each layer of noise drifts in a second, in its own cells, and what
// the twinkle turns, in radians.
const slowDrift = [0.12, 0.05] as const;

const fastDrift = [-0.35, 0.2] as const;

const twinkleSpeed = 2.4;

/** The moment the site draws `seconds` after it starts: 0 is its still. */
export const momentAt = (seconds: number): GlowMoment => ({
  beat: seconds * twinkleSpeed,
  fast: [seconds * fastDrift[0], seconds * fastDrift[1]],
  slow: [seconds * slowDrift[0], seconds * slowDrift[1]],
});

// The radius of the circle a layer goes round once in `period` seconds, at
// the speed it drifts at.
const orbitOf = (drift: readonly [number, number], period: number) =>
  (Math.hypot(...drift) * period) / (Math.PI * 2);

/**
 * The moment `seconds` into a motion that ends where it started after
 * `period` seconds: each layer of noise goes round a circle once, at the
 * speed it drifts at on the site, and the cells twinkle `beats` whole times.
 */
export const loopedMomentAt = (
  seconds: number,
  period: number,
  beats: number
): GlowMoment => {
  const angle = (seconds / period) * Math.PI * 2;
  const slow = orbitOf(slowDrift, period);
  const fast = orbitOf(fastDrift, period);

  return {
    beat: beats * angle,
    fast: [fast * Math.cos(angle), -fast * Math.sin(angle)],
    slow: [slow * Math.cos(angle), slow * Math.sin(angle)],
  };
};

/**
 * The tone a cell shows at a moment, as its place in its glow's tones
 * (strongest first), or null when it is unlit: the strongest tone near
 * the glow's heart, the faintest at its edge, dithered where two meet.
 */
export const shadeOf = (lit: LitCell, moment: GlowMoment): number | null => {
  const texture =
    0.7 +
    0.6 *
      (noise(lit.column / 14 + moment.slow[0], lit.row / 9 + moment.slow[1]) *
        0.7 +
        noise(lit.column / 4 + moment.fast[0], lit.row / 4 + moment.fast[1]) *
          0.3);

  const twinkle = 0.12 * Math.sin(moment.beat + lit.phase);
  const level = Math.min(ceiling, lit.reach * (texture + twinkle));

  if (level <= 0.06 + lit.dither * 0.75) {
    return null;
  }

  const shaded = level + (lit.dither - 0.5) * 0.2;
  const shade = steps.findIndex((step) => shaded > step);

  // A level barely past its threshold may be under every step.
  return shade === -1 ? faintest : shade;
};
