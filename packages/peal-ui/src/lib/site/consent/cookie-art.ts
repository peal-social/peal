// The consent notice's art (DESIGN.md, Site): a round pixel cookie on a
// 17 by 17 grid of 5 px cells, its dough in the blue and lavender tints,
// Bayer-dithered, its rim in lavender, and seven chips in the mark's blue,
// lavender and yellow that twinkle each on its own beat. `frameOf` is pure
// (the lit cells and their tones for a state at a time), so tests read it;
// `createCookieArt` draws frames on a 2D canvas, crisp at the device's
// pixel ratio, only while the canvas is on screen and never with reduced
// motion. Decoration: screen readers skip it.

/** The grid's width and height, in cells. */
export const gridSize = 17;

/** A cell's side, in CSS pixels, as every pixel art of the site's. */
export const cellSize = 5;

/** What a lit cell is drawn in: each a token of the palette. */
export type Tone =
  | "blue"
  | "dough"
  | "doughAlt"
  | "lavender"
  | "rim"
  | "scan"
  | "spark"
  | "sun";

export interface Cell {
  readonly tone: Tone;
  readonly x: number;
  readonly y: number;
}

/**
 * Where the art is: `baking` while it appears, `idle` at rest, `allow` and
 * `refuse` while the pointer or focus is on an answer (each played forward
 * over `previewMs`), `allowed` and `refused` the exits, equally long.
 */
export type ArtState =
  | "allow"
  | "allowed"
  | "baking"
  | "idle"
  | "refuse"
  | "refused";

/** How long an answer's preview plays. */
export const previewMs = 280;

/** How long either exit plays: the same, so no answer is rewarded more. */
export const exitMs = 700;

/** How long the cookie takes to bake in. */
export const bakeMs = 400;

const centre = 8;

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const threshold = (x: number, y: number) =>
  ((bayer[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;

// A fixed per-cell order in [0, 1), so cells switch in a scatter.
const scatter = (x: number, y: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43_758.5453;

  return value - Math.floor(value);
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

const easeIn = (t: number) => t * t * t;

const inside = ({ x, y }: { readonly x: number; readonly y: number }) =>
  x >= 0 && y >= 0 && x < gridSize && y < gridSize;

// The cookie's own cells: a disc, its outer ring the rim.
const cookieCells: readonly Cell[] = Array.from(
  { length: gridSize * gridSize },
  (_, index) => {
    const x = index % gridSize;
    const y = Math.floor(index / gridSize);
    const distance = Math.hypot(x - centre, y - centre);

    if (distance > 7.6) {
      return [];
    }

    if (distance > 6.4) {
      return [{ tone: "rim" as const, x, y }];
    }

    // The two tints, dithered, a little more lavender toward the foot.
    const lean = 0.35 + (y / gridSize) * 0.3;

    return [
      {
        tone:
          threshold(x, y) < lean ? ("doughAlt" as const) : ("dough" as const),
        x,
        y,
      },
    ];
  }
).flat();

interface Chip {
  readonly cells: readonly { readonly x: number; readonly y: number }[];
  /** Its beat, in radians: none starts lit, so time 0 is the still frame. */
  readonly phase: number;
  readonly tone: "blue" | "lavender" | "sun";
}

const chips: readonly Chip[] = [
  {
    cells: [
      { x: 5, y: 4 },
      { x: 6, y: 4 },
    ],
    phase: 0,
    tone: "blue",
  },
  {
    cells: [
      { x: 11, y: 4 },
      { x: 11, y: 5 },
    ],
    phase: 2.1,
    tone: "sun",
  },
  {
    cells: [
      { x: 3, y: 8 },
      { x: 3, y: 9 },
    ],
    phase: 4.4,
    tone: "lavender",
  },
  {
    cells: [
      { x: 8, y: 7 },
      { x: 9, y: 7 },
    ],
    phase: 0.9,
    tone: "sun",
  },
  { cells: [{ x: 6, y: 11 }], phase: 3.3, tone: "blue" },
  {
    cells: [
      { x: 12, y: 10 },
      { x: 12, y: 11 },
    ],
    phase: 5.2,
    tone: "lavender",
  },
  {
    cells: [
      { x: 9, y: 13 },
      { x: 10, y: 13 },
    ],
    phase: 2.7,
    tone: "blue",
  },
];

// Peal's mark in pixels, 7 by 7, at the cookie's centre: its top facets
// yellow, its right ones lavender, its left ones blue, as icon.svg has it.
const markRows = [
  "...S...",
  ".SSSSS.",
  "BSSSSSL",
  "BBBSLLL",
  "BBBBLLL",
  ".BBBLL.",
  "...BL..",
];

const markTones = { B: "blue", L: "lavender", S: "sun" } as const;

const isMarkKey = (key: string): key is keyof typeof markTones =>
  key === "B" || key === "L" || key === "S";

// A row of pixel art, one letter a cell.
const lettersOf = (row: string): string[] =>
  Array.from({ length: row.length }, (_, index) => row.charAt(index));

const markCells: readonly Cell[] = markRows.flatMap((row, y) =>
  lettersOf(row).flatMap((key, x) =>
    isMarkKey(key)
      ? [{ tone: markTones[key], x: x + centre - 3, y: y + centre - 3 }]
      : []
  )
);

// Each chip cell's place in the mark: the nearest free cell of its colour.
const chipTargets = (() => {
  const taken = new Set<number>();

  return chips.flatMap((chip) =>
    chip.cells.map((cell) => {
      const target =
        markCells
          .filter(
            (mark) =>
              mark.tone === chip.tone && !taken.has(mark.y * gridSize + mark.x)
          )
          .toSorted(
            (a, b) =>
              Math.hypot(a.x - cell.x, a.y - cell.y) -
              Math.hypot(b.x - cell.x, b.y - cell.y)
          )[0] ?? markCells[0];

      if (target !== undefined) {
        taken.add(target.y * gridSize + target.x);
      }

      return { from: cell, to: target ?? cell, tone: chip.tone };
    })
  );
})();

const twinkles = (chip: Chip, time: number) =>
  Math.sin((time / 1000) * 2.4 + chip.phase) > 0.93;

// Cells drawn later win: one per place.
const flattened = (cells: readonly Cell[]): Cell[] => {
  const byPlace = new Map<number, Cell>();

  for (const cell of cells) {
    const x = Math.round(cell.x);
    const y = Math.round(cell.y);

    if (inside({ x, y })) {
      byPlace.set(y * gridSize + x, { tone: cell.tone, x, y });
    }
  }

  return [...byPlace.values()];
};

// The cookie at rest at `time`: dough, rim, and the chips, one cell of a
// chip lit white at the top of its beat.
const restingCells = (time: number): Cell[] => [
  ...cookieCells,
  ...chips.flatMap((chip) =>
    chip.cells.map((cell, index) => ({
      tone:
        index === 0 && twinkles(chip, time) ? ("spark" as const) : chip.tone,
      x: cell.x,
      y: cell.y,
    }))
  ),
];

// The chips sliding into the mark, `progress` from 0 to 1.
const allowCells = (progress: number): Cell[] => {
  const eased = easeInOut(clamp(progress));

  // The mark's other cells fill in, in a scatter, as the chips arrive.
  const filled = markCells.filter(
    (cell) => scatter(cell.x, cell.y) * 0.6 + 0.4 < eased
  );

  return [
    ...cookieCells,
    ...filled,
    ...chipTargets.map(({ from, to, tone }) => ({
      tone,
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
    })),
  ];
};

const bite = { radius: 4.6, x: 14.6, y: 1.6 };

const inBite = (cell: { readonly x: number; readonly y: number }) =>
  Math.hypot(cell.x - bite.x, cell.y - bite.y) < bite.radius;

// Where the crumbs start, at the bite's edge, and fall two cells.
const crumbs: readonly Cell[] = [
  { tone: "rim", x: 11, y: 3 },
  { tone: "doughAlt", x: 13, y: 5 },
  { tone: "rim", x: 12, y: 1 },
];

// A bite dissolving from the top right, `progress` from 0 to 1, and three
// crumbs falling two cells.
const refuseCells = (progress: number, time: number): Cell[] => {
  const p = clamp(progress);

  const kept = restingCells(time).flatMap((cell) => {
    if (inBite(cell) && scatter(cell.x, cell.y) < p * 1.15) {
      return [];
    }

    // The bite's edge darkens into a rim once it is mostly gone.
    const edge =
      p > 0.5 &&
      !inBite(cell) &&
      Math.hypot(cell.x - bite.x, cell.y - bite.y) < bite.radius + 1;

    return [
      edge && cell.tone.startsWith("dough")
        ? { ...cell, tone: "rim" as const }
        : cell,
    ];
  });

  const fall = 2 * easeOut(clamp((p - 0.3) / 0.7));

  return [
    ...kept,
    ...(p > 0.3
      ? crumbs.map((crumb) => ({ ...crumb, y: crumb.y + fall }))
      : []),
  ];
};

// Allowed: the cookie folds into one yellow pixel, which drops off the
// art's foot, toward the footer where the answer can be changed, while a
// burst of pixels flies off it, as the pricing slider's does.
const foldMs = 260;
const dropMs = 400;
const burstMs = 360;

const burstTones = ["blue", "lavender", "sun"] as const;

const allowedCells = (time: number): Cell[] => {
  if (time < foldMs) {
    const e = easeIn(time / foldMs);

    return allowCells(1).map((cell) => ({
      tone: e > 0.55 ? ("sun" as const) : cell.tone,
      x: centre + (cell.x - centre) * (1 - e),
      y: centre + (cell.y - centre) * (1 - e),
    }));
  }

  const since = time - foldMs;
  const dropped = clamp(since / dropMs);

  const pixel = {
    tone: "sun" as const,
    x: centre,
    y: centre + 10 * easeIn(dropped),
  };

  const burstAge = since / burstMs;

  const burst =
    burstAge < 1
      ? Array.from({ length: 8 }, (_, index) => {
          const angle = (index / 8) * Math.PI * 2 + 0.4;
          const reach = 1.5 + 5 * easeOut(burstAge);

          return {
            tone: burstTones[index % 3] ?? ("sun" as const),
            x: centre + Math.cos(angle) * reach,
            y: centre + Math.sin(angle) * reach,
          };
        }).filter(
          // Thinning out as it ends, as the slider's burst fades.
          (_, index) => burstAge < 0.6 || threshold(index, 1) > burstAge - 0.2
        )
      : [];

  return dropped < 1 ? [...burst, pixel] : burst;
};

// Refused: the bitten cookie's cells crumble and fall, then a scanline
// sweeps the empty square once.
const crumbleMs = 280;
const gravity = 34 / 300 ** 2;
const scanFrom = 460;

const refusedCells = (time: number): Cell[] => {
  const fallen = refuseCells(1, 0).flatMap((cell) => {
    // Lower cells first, each a little apart from its neighbours.
    const delay =
      ((gridSize - 1 - cell.y) / gridSize) * crumbleMs * 0.6 +
      scatter(cell.x, cell.y) * crumbleMs * 0.4;

    const age = time - delay;

    if (age <= 0) {
      return [cell];
    }

    const drift = (scatter(cell.y, cell.x) - 0.5) * age * 0.006;

    return [
      { ...cell, x: cell.x + drift, y: cell.y + 0.5 * gravity * age * age },
    ];
  });

  const scanRow = Math.floor(
    ((time - scanFrom) / (exitMs - scanFrom)) * (gridSize + 1)
  );

  const scan =
    time >= scanFrom && scanRow < gridSize
      ? Array.from({ length: gridSize }, (_, x) => ({
          tone: "scan" as const,
          x,
          y: scanRow,
        }))
      : [];

  return [...fallen, ...scan];
};

// Baking in: the resting cells light in a scatter.
const bakingCells = (time: number): Cell[] => {
  const p = easeOut(clamp(time / bakeMs));

  return restingCells(0).filter((cell) => scatter(cell.y, cell.x) < p);
};

/**
 * The lit cells for a state at `time`, in milliseconds since the state
 * began: every one inside the grid, one per place. `idle` at 0 is the
 * still frame; `allowed` and `refused` are empty from `exitMs` on.
 */
export const frameOf = (state: ArtState, time: number): readonly Cell[] => {
  const t = Math.max(0, time);

  switch (state) {
    case "allow": {
      return flattened(allowCells(t / previewMs));
    }

    case "allowed": {
      return t >= exitMs ? [] : flattened(allowedCells(t));
    }

    case "baking": {
      return flattened(bakingCells(t));
    }

    case "idle": {
      return flattened(restingCells(t));
    }

    case "refuse": {
      return flattened(refuseCells(t / previewMs, 0));
    }

    case "refused": {
      return t >= exitMs ? [] : flattened(refusedCells(t));
    }

    default: {
      return [];
    }
  }
};

/** The still frame: the cookie at rest, as reduced motion shows it. */
export const stillFrame = (): readonly Cell[] => frameOf("idle", 0);

const smallTones: ReadonlyMap<string, Tone> = new Map([
  ["C", "blue"],
  ["D", "dough"],
  ["L", "lavender"],
  ["R", "rim"],
  ["S", "sun"],
]);

/** The phone's cookie, 5 by 5 cells, beside the title. */
export const smallFrame: readonly Cell[] = [
  ".RRR.",
  "RDCDR",
  "RDDSR",
  "RLDDR",
  ".RRR.",
].flatMap((row, y) =>
  lettersOf(row).flatMap((key, x) => {
    const tone = smallTones.get(key);

    return tone === undefined ? [] : [{ tone, x, y }];
  })
);

/** Each tone's colour: a token on the canvas, or a literal. */
const toneTokens: Record<Tone, string> = {
  blue: "--brand",
  dough: "--brand-tint",
  doughAlt: "--consent-lavender-tint",
  lavender: "--lavender",
  rim: "--lavender",
  scan: "--lavender",
  spark: "--card",
  sun: "--sun",
};

/** What the notice asks of its art. */
export interface CookieArt {
  /** Plays the art's appearance. */
  readonly bake: () => void;
  /** Turns the preview of an answer on, or back off with `undefined`. */
  readonly preview: (answer: "allow" | "refuse" | undefined) => void;
  /** Plays an answer's exit, `exitMs` long; the square then stays empty. */
  readonly exit: (answer: "allowed" | "refused") => void;
  readonly dispose: () => void;
}

/** Draws `cells` on a canvas of `columns` cells, crisp at `ratio`. */
export const drawCells = (
  canvas: HTMLCanvasElement,
  cells: readonly Cell[],
  columns: number
): void => {
  const context = canvas.getContext("2d");

  if (context === null) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const side = Math.round(columns * cellSize * ratio);

  if (canvas.width !== side || canvas.height !== side) {
    canvas.width = side;
    canvas.height = side;
  }

  const style = getComputedStyle(canvas);
  const colours = new Map<Tone, string>();

  // Each cell's edges rounded on their own, so cells meet without a gap
  // or an overlap at any ratio.
  const edge = (index: number) => Math.round(index * cellSize * ratio);

  context.clearRect(0, 0, side, side);

  for (const cell of cells) {
    let colour = colours.get(cell.tone);

    if (colour === undefined) {
      colour = style.getPropertyValue(toneTokens[cell.tone]).trim();
      colours.set(cell.tone, colour);
    }

    context.fillStyle = colour;
    context.fillRect(
      edge(cell.x),
      edge(cell.y),
      edge(cell.x + 1) - edge(cell.x),
      edge(cell.y + 1) - edge(cell.y)
    );
  }
};

// The twinkle runs at this many frames a second; moves run at the
// screen's own rate, so their easing stays smooth.
const framesPerSecond = 24;

/** The art on `canvas`, at rest until asked. */
export const createCookieArt = (canvas: HTMLCanvasElement): CookieArt => {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  let frame = 0;
  let lastTwinkle = 0;
  const start = performance.now();

  // What plays: a one-shot state since `since`, or the preview's progress.
  let shot:
    | {
        readonly length: number;
        readonly since: number;
        readonly state: "allowed" | "baking" | "refused";
      }
    | undefined;

  let previewed: "allow" | "refuse" = "allow";
  let wanted: "allow" | "refuse" | undefined;
  // From 0 (at rest) to 1 (the preview played), moved toward `wanted`.
  let progress = 0;
  let lastTick = start;
  // Once an exit played, the square stays empty.
  let gone = false;

  const paint = (now: number) => {
    if (gone && shot === undefined) {
      drawCells(canvas, [], gridSize);

      return;
    }

    if (still.matches) {
      drawCells(canvas, stillFrame(), gridSize);

      return;
    }

    if (shot !== undefined) {
      drawCells(canvas, frameOf(shot.state, now - shot.since), gridSize);

      return;
    }

    if (progress > 0) {
      drawCells(canvas, frameOf(previewed, progress * previewMs), gridSize);

      return;
    }

    drawCells(canvas, frameOf("idle", now - start), gridSize);
  };

  // Whether something moves, rather than only twinkles.
  const moving = () =>
    shot !== undefined ||
    (wanted !== undefined && wanted === previewed
      ? progress < 1
      : progress > 0);

  const loop = (now: number) => {
    frame = 0;

    const step = (now - lastTick) / previewMs;
    lastTick = now;

    if (wanted === undefined || wanted !== previewed) {
      // Back to rest first, then on to the other answer's preview.
      progress = Math.max(0, progress - step);

      if (progress === 0 && wanted !== undefined) {
        previewed = wanted;
      }
    } else {
      progress = Math.min(1, progress + step);
    }

    if (shot !== undefined && now - shot.since >= shot.length) {
      gone = shot.state !== "baking";
      shot = undefined;
    }

    const animating = moving();

    if (animating || now - lastTwinkle >= 1000 / framesPerSecond) {
      lastTwinkle = now;
      paint(now);
    }

    if (!still.matches && (animating || visible)) {
      frame = requestAnimationFrame(loop);
    }
  };

  const run = () => {
    if (still.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      paint(performance.now());

      return;
    }

    if (frame === 0) {
      lastTick = performance.now();
      frame = requestAnimationFrame(loop);
    }
  };

  // It twinkles only while on screen; a move plays to its end regardless.
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    run();
  });

  seen.observe(canvas);
  still.addEventListener("change", run);
  paint(performance.now());

  const play = (state: "allowed" | "baking" | "refused", length: number) => {
    shot = still.matches
      ? undefined
      : { length, since: performance.now(), state };
    gone = still.matches && state !== "baking";
    paint(performance.now());
    run();
  };

  return {
    bake: () => {
      gone = false;
      progress = 0;
      wanted = undefined;
      play("baking", bakeMs);
    },
    dispose: () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
      still.removeEventListener("change", run);
    },
    exit: (answer) => {
      play(answer, exitMs);
    },
    preview: (answer) => {
      wanted = answer;

      if (answer !== undefined && progress === 0) {
        previewed = answer;
      }

      run();
    },
  };
};
