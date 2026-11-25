// The pixel glow's geometry, which the site's canvas and the emails' art
// share: what a change here moves, both show.
import { describe, expect, it } from "vitest";

import {
  layouts,
  litCellsOf,
  loopedMomentAt,
  momentAt,
  shadeOf,
} from "../src/lib/pixel-glow";
import type { GlowMoment } from "../src/lib/pixel-glow";

const width = 600;

const height = 90;

const cells = {
  band: litCellsOf(width, height, layouts.band),
  hero: litCellsOf(width, height, layouts.hero),
};

const still = momentAt(0);

const numbersOf = ({ beat, fast, slow }: GlowMoment) => [
  Math.sin(beat),
  ...fast,
  ...slow,
];

describe("the cells a layout's glows reach", () => {
  it.each([
    {
      faintest: 74,
      layout: "band",
      middle: 133,
      reached: 1107,
      strongest: 199,
    },
    { faintest: 56, layout: "hero", middle: 134, reached: 943, strongest: 180 },
  ] as const)(
    "are $reached in the $layout layout, lit as the still shows them",
    ({ faintest, layout, middle, reached, strongest }) => {
      const shades = cells[layout].map((lit) => shadeOf(lit, still));

      const counted = (tone: number) =>
        shades.filter((shade) => shade === tone).length;

      expect(shades).toHaveLength(reached);
      expect([0, 1, 2].map(counted)).toStrictEqual([
        strongest,
        middle,
        faintest,
      ]);
    }
  );

  it.each([
    // Blue's heart, at the left of the band.
    { column: 0, glow: 0, layout: "band", reach: 0.98, row: 5, shade: 0 },
    // Lavender, in the corner the band starts it from.
    { column: 119, glow: 1, layout: "band", reach: 0.941, row: 0, shade: 0 },
    // Blue, over the hero's lead.
    { column: 101, glow: 0, layout: "hero", reach: 0.953, row: 0, shade: 0 },
    // Yellow, low at its right.
    { column: 117, glow: 2, layout: "hero", reach: 0.86, row: 17, shade: 0 },
    // A gap near a heart: no cell is sure to be lit.
    { column: 0, glow: 3, layout: "hero", reach: 0.884, row: 17, shade: null },
  ] as const)(
    "show glow $glow at column $column and row $row of the $layout layout",
    ({ column, glow, layout, reach, row, shade }) => {
      const lit = cells[layout].find(
        (found) => found.column === column && found.row === row
      );

      expect(lit?.glow).toBe(glow);
      expect(lit?.reach).toBeCloseTo(reach, 3);
      expect(lit === undefined ? undefined : shadeOf(lit, still)).toBe(shade);
    }
  );

  it("leave the left of the hero, where the headline is, clear", () => {
    expect(
      cells.hero.filter(({ column, glow }) => column < 60 && glow !== 3)
    ).toStrictEqual([]);
  });
});

describe(momentAt, () => {
  it("drifts and beats at the site's speeds", () => {
    expect(momentAt(10)).toStrictEqual({
      beat: 24,
      fast: [-3.5, 2],
      slow: [1.2, 0.5],
    });
  });
});

// How fast a layer moves, a second into the motion.
const speedOf = (
  layer: "fast" | "slow",
  momentOf: (seconds: number) => GlowMoment
) => {
  const [x, y] = momentOf(1)[layer];
  const [nextX, nextY] = momentOf(1.001)[layer];

  return Math.hypot(nextX - x, nextY - y) / 0.001;
};

describe(loopedMomentAt, () => {
  it("ends where it started", () => {
    const end = numbersOf(loopedMomentAt(4.8, 4.8, 2));

    for (const [index, start] of numbersOf(
      loopedMomentAt(0, 4.8, 2)
    ).entries()) {
      expect(end[index]).toBeCloseTo(start, 12);
    }
  });

  it("moves each layer as fast as the site does", () => {
    for (const layer of ["fast", "slow"] as const) {
      expect(
        speedOf(layer, (seconds) => loopedMomentAt(seconds, 4.8, 2))
      ).toBeCloseTo(speedOf(layer, momentAt), 4);
    }
  });
});
