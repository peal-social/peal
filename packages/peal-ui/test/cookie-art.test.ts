import { describe, expect, it } from "vitest";

import {
  bakeMs,
  exitMs,
  frameOf,
  gridSize,
  previewMs,
  smallFrame,
  stillFrame,
} from "../src/lib/site/consent/cookie-art";
import type { ArtState } from "../src/lib/site/consent/cookie-art";

const states: readonly ArtState[] = [
  "allow",
  "allowed",
  "baking",
  "idle",
  "refuse",
  "refused",
];

const times = Array.from({ length: 60 }, (_, index) => index * 25);

describe("the pixel cookie", () => {
  it("draws the same frame for the same state and time", () => {
    for (const state of states) {
      for (const time of [0, 140, 333, 699]) {
        expect(frameOf(state, time)).toStrictEqual(frameOf(state, time));
      }
    }
  });

  it("keeps every cell inside the grid, one per place", () => {
    for (const state of states) {
      for (const time of times) {
        const cells = frameOf(state, time);
        const places = new Set(cells.map(({ x, y }) => y * gridSize + x));

        expect(places.size).toBe(cells.length);

        for (const { x, y } of cells) {
          expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
          expect(x >= 0 && x < gridSize && y >= 0 && y < gridSize).toBe(true);
        }
      }
    }
  });

  it("starts idle on the still frame, a round cookie with its chips", () => {
    expect(frameOf("idle", 0)).toStrictEqual(stillFrame());

    const tones = new Set(stillFrame().map(({ tone }) => tone));

    expect([...tones].toSorted()).toStrictEqual([
      "blue",
      "dough",
      "doughAlt",
      "lavender",
      "rim",
      "sun",
    ]);
  });

  it("twinkles at rest, and bakes in to the still frame", () => {
    const twinkled = times.some((time) =>
      frameOf("idle", time * 40).some(({ tone }) => tone === "spark")
    );

    expect(twinkled).toBe(true);
    expect(frameOf("baking", 0).length).toBeLessThan(stillFrame().length);
    expect(frameOf("baking", bakeMs)).toStrictEqual(stillFrame());
  });

  it("previews Allow as the mark at the cookie's centre, and the other answer as a bite", () => {
    const allowed = frameOf("allow", previewMs);
    const bitten = frameOf("refuse", previewMs);

    // The mark's top facet, yellow, where the cookie's centre was dough.
    expect(allowed.find(({ x, y }) => x === 8 && y === 6)?.tone).toBe("sun");
    // The top right corner is bitten off.
    expect(bitten.some(({ x, y }) => x === 13 && y === 3)).toBe(false);
    expect(stillFrame().some(({ x, y }) => x === 13 && y === 3)).toBe(true);
  });

  it("ends both exits empty after the same time, and neither sooner", () => {
    for (const exit of ["allowed", "refused"] as const) {
      expect(frameOf(exit, 0).length).toBeGreaterThan(0);
      expect(frameOf(exit, exitMs - 100).length).toBeGreaterThan(0);
      expect(frameOf(exit, exitMs)).toStrictEqual([]);
      expect(frameOf(exit, exitMs + 500)).toStrictEqual([]);
    }
  });

  it("has a 5 by 5 cookie for phones", () => {
    for (const { x, y } of smallFrame) {
      expect(x >= 0 && x < 5 && y >= 0 && y < 5).toBe(true);
    }
  });
});
