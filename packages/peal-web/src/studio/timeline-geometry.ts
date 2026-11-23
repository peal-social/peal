import type { ClipView } from "#studio/edit-document.ts";

// Where things sit on the timeline: seconds to pixels at a zoom, the
// ruler's marks, and what dragging or trimming a clip does, snapped to the
// playhead and to the other clips' edges.

/** Pixels a second at each zoom step, closest first. */
export const zoomSteps = [12, 20, 32, 48, 72, 108, 160] as const;

/** The zoom a timeline opens at. */
export const defaultZoom = 3;

/** The shortest a clip may be, in seconds. */
export const shortestClip = 0.1;

/** How close, in pixels, an edge must come to snap. */
export const snapPixels = 8;

/** A time as a player writes it: minutes, then seconds with a tenth. */
export const clockOf = (seconds: number): string => {
  const tenths = Math.round(Math.max(seconds, 0) * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths % 600) / 10;

  return `${String(minutes)}:${rest.toFixed(1).padStart(4, "0")}`;
};

/** Seconds rounded to a tenth, as clips are placed. */
export const tenth = (seconds: number): number => Math.round(seconds * 10) / 10;

/** The ruler: a mark every few seconds to past the end, some labelled. */
export interface Ruler {
  /** Every how many seconds a mark is labelled. */
  readonly labelEvery: number;
  readonly marks: readonly number[];
}

/** The ruler for a zoom, to past the end. */
export const rulerOf = (pixelsPerSecond: number, end: number): Ruler => {
  // A label at least 64 pixels from the next.
  const labelEvery =
    [1, 2, 5, 10, 15, 30, 60].find((each) => each * pixelsPerSecond >= 64) ??
    60;

  const step = labelEvery >= 5 ? labelEvery / 5 : labelEvery;
  const last = Math.ceil(end / labelEvery) * labelEvery + labelEvery;

  return {
    labelEvery,
    marks: Array.from({ length: Math.round(last / step) + 1 }, (_, index) =>
      tenth(index * step)
    ),
  };
};

/**
 * The edges a moving edge may snap to: the playhead, the start, and both
 * edges of every other clip.
 */
export const snapTargetsOf = (
  clips: readonly ClipView[],
  movingId: string,
  playhead: number
): readonly number[] => [
  0,
  playhead,
  ...clips
    .filter(({ id }) => id !== movingId)
    .flatMap(({ length, start }) => [start, start + length]),
];

/** The time snapped to the nearest target within `snapPixels`, or as it is. */
export const snapped = (
  time: number,
  targets: readonly number[],
  pixelsPerSecond: number
): number => {
  let nearest = time;
  let distance = snapPixels / pixelsPerSecond;

  for (const target of targets) {
    const away = Math.abs(target - time);

    if (away <= distance) {
      nearest = target;
      distance = away;
    }
  }

  return nearest;
};

/**
 * Where a clip dragged by `deltaSeconds` starts: its start or its end
 * snapped, whichever comes closer, never before 0.
 */
export const movedStart = (
  clip: Pick<ClipView, "length" | "start">,
  deltaSeconds: number,
  targets: readonly number[],
  pixelsPerSecond: number
): number => {
  const start = Math.max(0, clip.start + deltaSeconds);
  const end = start + clip.length;

  const byStart = snapped(start, targets, pixelsPerSecond) - start;
  const byEnd = snapped(end, targets, pixelsPerSecond) - end;

  // The edge that snaps the shorter way; one that does not snap moves 0.
  const shift =
    byStart === 0 || (byEnd !== 0 && Math.abs(byEnd) < Math.abs(byStart))
      ? byEnd
      : byStart;

  return tenth(Math.max(0, start + shift));
};

/** Where a clip starts and how long it lasts, in seconds. */
export interface Timing {
  readonly length: number;
  readonly start: number;
}

/** Which edge of a clip is dragged to trim it. */
export type Edge = "end" | "start";

/**
 * A clip trimmed from one edge by `deltaSeconds`: from the end its length
 * changes; from the start its start moves and its end stays. Snapped, and
 * never shorter than `shortestClip` nor before 0.
 */
export const trimmed = (
  clip: Pick<ClipView, "length" | "start">,
  edge: Edge,
  deltaSeconds: number,
  targets: readonly number[],
  pixelsPerSecond: number
): Timing => {
  const end = clip.start + clip.length;

  if (edge === "end") {
    const moved = snapped(end + deltaSeconds, targets, pixelsPerSecond);

    return {
      length: tenth(Math.max(shortestClip, moved - clip.start)),
      start: clip.start,
    };
  }

  const moved = Math.max(
    0,
    Math.min(
      snapped(clip.start + deltaSeconds, targets, pixelsPerSecond),
      end - shortestClip
    )
  );

  return { length: tenth(end - moved), start: tenth(moved) };
};

/**
 * Where stepping lands from `time`: the next or the previous edge of any
 * clip, else the video's end or its start.
 */
export const steppedTime = (
  clips: readonly ClipView[],
  time: number,
  by: -1 | 1,
  duration: number
): number => {
  const edges = [
    0,
    ...clips.flatMap(({ length, start }) => [start, start + length]),
  ].toSorted((left, right) => left - right);

  if (by === 1) {
    return edges.find((edge) => edge > time + 0.05) ?? duration;
  }

  return edges.findLast((edge) => edge < time - 0.05) ?? 0;
};

/** The track a vertical drag lands on, within the tracks there are. */
export const trackAfterDrag = (
  trackIndex: number,
  deltaPixels: number,
  rowPixels: number,
  tracks: number
): number =>
  Math.min(
    Math.max(trackIndex + Math.round(deltaPixels / rowPixels), 0),
    tracks - 1
  );
