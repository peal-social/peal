import {
  cell,
  layouts,
  litCellsOf,
  loopedMomentAt,
  shadeOf,
} from "../../src/lib/pixel-glow";
import type { PixelGlowLayout } from "../../src/lib/pixel-glow";
import { toneIndex } from "./colours";
import type { Picture } from "./picture";

/** A piece of the emails' art: a field of glow, and the columns kept of it. */
export interface Piece {
  /** The cell columns kept, the last one excluded. */
  readonly columns: readonly [from: number, to: number];
  /** The field's size, in CSS pixels. */
  readonly field: readonly [width: number, height: number];
  readonly layout: PixelGlowLayout;
}

// Twice the cells' size on the site, for a screen of twice the density.
const cellPixels = cell * 2;

/** How long the glow moves, in seconds. */
export const period = 4.8;

// How many times each cell twinkles meanwhile.
const beats = 2;

/** A frame's time on screen, in hundredths of a second. */
export const frameDelay = 13;

// The piece, `seconds` into its motion.
const frameAt = (
  { columns: [from, to], field: [width, height], layout }: Piece,
  seconds: number
): Picture => {
  const glows = layouts[layout];
  const moment = loopedMomentAt(seconds, period, beats);
  const rowPixels = (to - from) * cellPixels;
  const pixelRows = (height / cell) * cellPixels;
  const pixels = new Uint8Array(rowPixels * pixelRows);

  for (const lit of litCellsOf(width, height, glows)) {
    const shade = shadeOf(lit, moment);
    const tone = shade === null ? undefined : glows[lit.glow]?.tones[shade];

    if (tone !== undefined && lit.column >= from && lit.column < to) {
      const left = (lit.column - from) * cellPixels;

      for (let y = 0; y < cellPixels; y += 1) {
        const start = (lit.row * cellPixels + y) * rowPixels + left;

        pixels.fill(toneIndex(tone), start, start + cellPixels);
      }
    }
  }

  return { height: pixelRows, pixels, width: rowPixels };
};

/** The piece at rest: the first frame of its motion, and the last. */
export const stillOf = (piece: Piece): Picture => frameAt(piece, 0);

/** Every frame of the piece's motion, which ends on the first again. */
export const framesOf = (piece: Piece): readonly Picture[] => [
  ...Array.from(
    { length: Math.round((period * 100) / frameDelay) },
    (_, index) => frameAt(piece, (index * frameDelay) / 100)
  ),
  stillOf(piece),
];
