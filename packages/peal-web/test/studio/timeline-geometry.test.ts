import { describe, expect, it } from "@effect/vitest";

import type { ClipView } from "#studio/edit-document.ts";
import {
  movedStart,
  rulerOf,
  snapTargetsOf,
  snapped,
  trackAfterDrag,
  trimmed,
} from "#studio/timeline-geometry.ts";

const clip = (id: string, start: number, length: number): ClipView => ({
  id,
  kind: "image",
  length,
  mediaId: null,
  start,
  text: null,
  trackIndex: 0,
});

const first = clip("a", 0, 4);

const clips = [first, clip("b", 6, 2)];

// 40 pixels a second: an edge snaps within 0.2 s.
const pixels = 40;

describe("the timeline's geometry", () => {
  it("labels the ruler no closer than 64 pixels, with marks between", () => {
    expect([
      rulerOf(40, 3).labelEvery,
      rulerOf(12, 3).labelEvery,
    ]).toStrictEqual([2, 10]);
    expect(rulerOf(72, 2).marks).toStrictEqual([0, 1, 2, 3]);
  });

  it("snaps to the playhead and the other clips' edges, never to the clip's own", () => {
    const targets = snapTargetsOf(clips, "a", 5);

    expect(targets).toStrictEqual([0, 5, 6, 8]);
    expect([
      snapped(5.9, targets, pixels),
      snapped(5.5, targets, pixels),
    ]).toStrictEqual([6, 5.5]);
  });

  it("moves a clip by its nearer edge, never before the start", () => {
    const targets = snapTargetsOf(clips, "a", 0);

    expect([
      movedStart(first, 1.9, targets, pixels),
      movedStart(first, 3, targets, pixels),
      movedStart(first, -2, targets, pixels),
    ]).toStrictEqual([2, 3, 0]);
  });

  it("trims from either edge, keeping the other where it is", () => {
    const targets = snapTargetsOf(clips, "a", 0);

    expect([
      trimmed(first, "end", 1.9, targets, pixels),
      trimmed(first, "start", 1, targets, pixels),
      trimmed(first, "start", 10, targets, pixels),
      trimmed(first, "end", -10, targets, pixels),
    ]).toStrictEqual([
      { length: 6, start: 0 },
      { length: 3, start: 1 },
      { length: 0.1, start: 3.9 },
      { length: 0.1, start: 0 },
    ]);
  });

  it("lands a vertical drag on a track that exists", () => {
    expect([
      trackAfterDrag(0, 50, 48, 3),
      trackAfterDrag(1, -200, 48, 3),
      trackAfterDrag(2, 200, 48, 3),
    ]).toStrictEqual([1, 0, 2]);
  });
});
