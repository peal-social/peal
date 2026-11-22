// The support launcher's art (DESIGN.md, "Support chat"): a speech bubble
// on a 12 by 12 grid, in the mark's blue with a lavender light at its top
// left and a darker blue edge toward the bottom right, holding three dots
// that type in yellow, one after the other. `launcherFrame` is pure (the
// lit cells and their tones for a state at a time), so tests read it;
// `createLauncherArt` draws frames on a 2D canvas, crisp at the device's
// pixel ratio, only while the canvas is on screen and never with reduced
// motion. Decoration: screen readers hear the button's name.

/** The grid's width and height, in cells. */
export const launcherGrid = 12;

/** A cell's side, in CSS pixels: the art is 24 px square. */
export const launcherCell = 2;

/** What a lit cell is drawn in: each a token of the palette. */
export type LauncherTone = "dot" | "edge" | "light" | "body" | "typing";

export interface LauncherCell {
  readonly tone: LauncherTone;
  readonly x: number;
  readonly y: number;
}

/**
 * What the launcher shows: `idle` at rest, typing once every few seconds;
 * `active` while the pointer or focus is on it, typing on; `loading` while
 * Crisp loads after a press, typing fast; `unread` while replies wait, its
 * dots yellow and typing slowly.
 */
export type LauncherState = "active" | "idle" | "loading" | "unread";

// The bubble: B its body, L the light, E the edge, d a dot's cell.
const bubble = [
  "..LLBBBBBB..",
  ".LLBBBBBBBB.",
  "LLBBBBBBBBBB",
  "LBBBBBBBBBBE",
  "BBddBddBddBE",
  "BBddBddBddBE",
  "BBBBBBBBBBBE",
  ".BBBBBBBBBE.",
  "..BBEEEEEE..",
  "..BE........",
  ".BE.........",
  ".E..........",
];

const tones: ReadonlyMap<string, LauncherTone> = new Map([
  ["B", "body"],
  ["E", "edge"],
  ["L", "light"],
]);

// The three dots' first columns, left to right; each is 2 by 2 on rows 4
// and 5, and rises one row while it types.
const dotColumns = [2, 5, 8] as const;
const dotRow = 4;

// How long a dot types for each state, in milliseconds; the three take
// turns, so a wave lasts three times as long.
const beat: Record<Exclude<LauncherState, "idle">, number> = {
  active: 260,
  loading: 150,
  unread: 420,
};

// At rest, one wave every this many milliseconds.
const idleEvery = 4000;
const idleBeat = 260;

/** Which dot types at `time`, or none. */
export const typingDot = (
  state: LauncherState,
  time: number
): number | undefined => {
  if (state === "idle") {
    const into = time % idleEvery;

    return into < idleBeat * 3 ? Math.floor(into / idleBeat) : undefined;
  }

  return Math.floor(time / beat[state]) % dotColumns.length;
};

/** The cells lit for `state` at `time`, in milliseconds since it began. */
export const launcherFrame = (
  state: LauncherState,
  time: number
): readonly LauncherCell[] => {
  const typing = typingDot(state, time);
  const dotTone: LauncherTone = state === "unread" ? "typing" : "dot";
  const cells: LauncherCell[] = [];

  for (const [y, row] of bubble.entries()) {
    // The rows are ASCII: one character a cell.
    for (let x = 0; x < row.length; x += 1) {
      const key = row.charAt(x);
      const tone = tones.get(key);

      if (tone !== undefined) {
        cells.push({ tone, x, y });
      }

      if (key === "d") {
        cells.push({ tone: "body", x, y });
      }
    }
  }

  for (const [index, column] of dotColumns.entries()) {
    const lift = index === typing ? 1 : 0;
    const tone = index === typing ? "typing" : dotTone;

    for (const dx of [0, 1]) {
      for (const dy of [0, 1]) {
        cells.push({ tone, x: column + dx, y: dotRow + dy - lift });
      }
    }
  }

  return cells;
};

/** The frame drawn with reduced motion, and before anything plays. */
export const stillLauncherFrame = (
  state: LauncherState
): readonly LauncherCell[] =>
  launcherFrame(state === "unread" ? "unread" : "idle", idleEvery - 1);

/** Each tone's colour: a token of tokens.css on the canvas. */
const toneTokens: Record<LauncherTone, string> = {
  body: "--brand",
  dot: "--card",
  edge: "--brand-hover",
  light: "--lavender",
  typing: "--sun",
};

const draw = (canvas: HTMLCanvasElement, cells: readonly LauncherCell[]) => {
  const context = canvas.getContext("2d");

  if (context === null) {
    return;
  }

  const ratio = window.devicePixelRatio || 1;
  const side = Math.round(launcherGrid * launcherCell * ratio);

  if (canvas.width !== side || canvas.height !== side) {
    canvas.width = side;
    canvas.height = side;
  }

  const style = getComputedStyle(canvas);
  // Each cell's edges rounded on their own, so cells meet without a gap.
  const edge = (index: number) => Math.round(index * launcherCell * ratio);

  context.clearRect(0, 0, side, side);

  for (const cell of cells) {
    context.fillStyle = style.getPropertyValue(toneTokens[cell.tone]).trim();
    context.fillRect(
      edge(cell.x),
      edge(cell.y),
      edge(cell.x + 1) - edge(cell.x),
      edge(cell.y + 1) - edge(cell.y)
    );
  }
};

/** What the launcher asks of its art. */
export interface LauncherArt {
  readonly set: (state: LauncherState) => void;
  readonly dispose: () => void;
}

// Frames a second: the dots move cell by cell, so this is plenty.
const framesPerSecond = 24;

/** The art on `canvas`, idle until told otherwise. */
export const createLauncherArt = (canvas: HTMLCanvasElement): LauncherArt => {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let state: LauncherState = "idle";
  let since = performance.now();
  let visible = true;
  let frame = 0;
  let last = 0;

  const loop = (now: number) => {
    frame = 0;

    if (now - last >= 1000 / framesPerSecond) {
      last = now;
      draw(canvas, launcherFrame(state, now - since));
    }

    if (visible && !still.matches) {
      frame = requestAnimationFrame(loop);
    }
  };

  const run = () => {
    if (still.matches || !visible) {
      cancelAnimationFrame(frame);
      frame = 0;
      draw(canvas, stillLauncherFrame(state));

      return;
    }

    if (frame === 0) {
      frame = requestAnimationFrame(loop);
    }
  };

  const seen = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    run();
  });

  seen.observe(canvas);
  still.addEventListener("change", run);
  draw(canvas, stillLauncherFrame(state));

  return {
    dispose: () => {
      cancelAnimationFrame(frame);
      frame = 0;
      seen.disconnect();
      still.removeEventListener("change", run);
    },
    set: (next) => {
      if (next !== state) {
        state = next;
        since = performance.now();
        last = 0;
        run();
      }
    },
  };
};
