import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { Media } from "peal-contract";

import { slideOf } from "#assistant/slideshows.ts";
import type { SlideDraft } from "#assistant/slideshows.ts";
import {
  clampedTime,
  clipAt,
  clipsOf,
  clockOf,
  durationOf,
  frameOf,
  steppedClip,
} from "#studio/timeline.ts";

const at = DateTime.makeUnsafe("2026-11-23T09:00:00Z");

const media = (
  id: string,
  overrides: Partial<Pick<Media, "contentType" | "durationMs" | "kind">> = {}
): Media => ({
  aiGenerated: false,
  altText: null,
  byteSize: 1000,
  codec: null,
  contentType: "image/jpeg",
  createdAt: at,
  dimensions: null,
  durationMs: null,
  fileName: null,
  id,
  kind: "image",
  pageCount: null,
  status: { _tag: "ready" },
  updatedAt: at,
  url: null,
  ...overrides,
});

const slides = (count: number): readonly SlideDraft[] =>
  Array.from({ length: count }, (_, index) => slideOf(media(`image-${index}`)));

const rounded = (value: number) => Math.round(value * 100) / 100;

const three = clipsOf({
  secondsPerSlide: 4,
  slides: slides(3),
  voiceover: null,
});

describe("the editor's timeline", () => {
  it("lays the clips end to end, each as long as the others", () => {
    expect(three).toStrictEqual([
      { id: "image-0", index: 0, length: 4, start: 0 },
      { id: "image-1", index: 1, length: 4, start: 4 },
      { id: "image-2", index: 2, length: 4, start: 8 },
    ]);
    expect(durationOf(three)).toBe(12);
    expect(durationOf([])).toBe(0);
  });

  it("shares the voice-over's length between the clips when fitted to it", () => {
    const fitted = clipsOf({
      secondsPerSlide: null,
      slides: slides(3),
      voiceover: media("voice", {
        contentType: "audio/mpeg",
        durationMs: 15_000,
        kind: "audio",
      }),
    });

    expect(fitted.map(({ length }) => length)).toStrictEqual([5, 5, 5]);
    expect(durationOf(fitted)).toBe(15);
  });

  it("finds the clip at an instant, the last one once the video has ended", () => {
    expect(clipAt(three, 0)?.index).toBe(0);
    expect(clipAt(three, 3.99)?.index).toBe(0);
    expect(clipAt(three, 4)?.index).toBe(1);
    expect(clipAt(three, 12)?.index).toBe(2);
    expect(clipAt([], 1)).toBeNull();
  });

  it("keeps a time within the video", () => {
    expect(clampedTime(-1, 12)).toBe(0);
    expect(clampedTime(13, 12)).toBe(12);
    expect(clampedTime(5, 12)).toBe(5);
  });

  it("fades a clip in and out over a second, and holds it between", () => {
    const [first] = three;

    if (first === undefined) {
      throw new Error("no clip");
    }

    const faded = [0, 0.5, 2, 3.5].map(
      (time) => frameOf(first, time, "none", "fade").opacity
    );

    const cut = [0, 2].map(
      (time) => frameOf(first, time, "none", "none").opacity
    );

    expect([faded, cut]).toStrictEqual([
      [0, 0.5, 1, 0.5],
      [1, 1],
    ]);
  });

  it("moves the image as its motion says, over its clip", () => {
    const [first] = three;

    if (first === undefined) {
      throw new Error("no clip");
    }

    const ends = (["zoomIn", "zoomOut", "slide"] as const).map((motion) =>
      [0, 4].map((time) => {
        const frame = frameOf(first, time, motion, "none");

        return [rounded(frame.scale), rounded(frame.shift)];
      })
    );

    expect(ends).toStrictEqual([
      [
        [1, 0],
        [1.3, 0],
      ],
      [
        [1.3, 0],
        [1, 0],
      ],
      [
        [1.16, 0.08],
        [1.16, -0.08],
      ],
    ]);
    expect(frameOf(first, 2, "none", "none")).toStrictEqual({
      opacity: 1,
      scale: 1,
      shift: 0,
    });
  });

  it("steps to the next clip, and back to the start of the one playing first", () => {
    const steps = (
      [
        [1, 1],
        [9, 1],
        [6, -1],
        [4.2, -1],
        [0, -1],
      ] as const
    ).map(([time, by]) => steppedClip(three, time, by)?.index);

    expect(steps).toStrictEqual([1, 2, 1, 0, 0]);
    expect(steppedClip([], 0, 1)).toBeNull();
  });

  it("writes a time as a player does", () => {
    expect(clockOf(0)).toBe("0:00.0");
    expect(clockOf(4.26)).toBe("0:04.3");
    expect(clockOf(75.5)).toBe("1:15.5");
    expect(clockOf(-2)).toBe("0:00.0");
  });
});
