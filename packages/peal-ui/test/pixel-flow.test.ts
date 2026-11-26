// The page's pixel art keeps the icon readable while its field flows:
// strokes stay lit, empty space stays empty, and the decode ends settled.
import { describe, expect, it } from "vitest";

import {
  decodeAt,
  flowAt,
  flowLevels,
  haloOf,
  levelAt,
} from "../src/lib/pixel-flow.ts";

const dithers = [0.03, 0.25, 0.5, 0.75, 0.97];

describe("the page's pixel art", () => {
  it("draws a full stroke in the mark's blue while the field is still", () => {
    expect(levelAt(1, 1, 0, 0.5, 0)).toBe(flowLevels - 1);
  });

  it("keeps a full stroke at lavender or brighter whatever the field does", () => {
    for (const flow of [-1, -0.5, 0, 0.5, 1]) {
      for (const dither of dithers) {
        expect(levelAt(1, 1, flow, dither, 0)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("turns a full stroke yellow only at the field's crest", () => {
    expect(levelAt(1, 1, 1, 0.5, 0)).toBe(flowLevels);
    expect(levelAt(1, 1, 0, 0.97, 0)).toBeLessThan(flowLevels);
  });

  it("leaves a cell far from the icon empty whatever the field does", () => {
    for (const flow of [-1, 0, 1]) {
      for (const dither of dithers) {
        expect(levelAt(0, 0, flow, dither, 0)).toBe(0);
      }
    }
  });

  it("lights a dim pixel near the strokes only where the field crests", () => {
    expect(levelAt(0, 0.6, 0, 0.5, 0)).toBe(0);
    expect(levelAt(0, 0.6, -1, 0.97, 0)).toBe(0);
    expect(levelAt(0, 0.6, 1, 0.5, 0)).toBeGreaterThan(0);
    expect(levelAt(0, 0.6, 1, 0.97, 0)).toBeLessThanOrEqual(2);
  });

  it("lights only some of the cells near the strokes", () => {
    expect(levelAt(0, 0.6, 1, 0.97, 0.9)).toBe(0);
  });

  it("keeps the field between -1 and 1", () => {
    for (let step = 0; step < 200; step += 1) {
      expect(
        Math.abs(flowAt(step % 17, step % 11, step / 7))
      ).toBeLessThanOrEqual(1);
    }
  });

  it("settles every cell by the decode's end, the left ones first", () => {
    expect(decodeAt(0, 5, 30, 1)).toBe("settled");
    expect(decodeAt(29, 5, 30, 1)).toBe("settled");
    expect(decodeAt(29, 5, 30, 0.2)).toBe("blank");
    expect(decodeAt(0, 5, 30, 0.2)).not.toBe("blank");
  });

  it("spreads the icon's coverage two cells around, and no farther", () => {
    const cover = new Float32Array(9 * 9);
    cover[4 * 9 + 4] = 1;

    const halo = haloOf(cover, 9, 9);

    expect(halo[4 * 9 + 2]).toBeGreaterThan(0);
    expect(halo[2 * 9 + 4]).toBeGreaterThan(0);
    expect(halo[4 * 9 + 1]).toBe(0);
    expect(halo[0]).toBe(0);
  });
});
