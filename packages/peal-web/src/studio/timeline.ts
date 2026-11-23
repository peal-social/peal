import type { ImageAspect, SlideMotion, SlideTransition } from "peal-contract";

import { secondsPerSlideOf } from "#assistant/slideshows.ts";
import type { SlideshowChoice } from "#assistant/slideshows.ts";

// The editor's timeline: where each clip sits, what the preview shows at
// an instant, and how it moves. The export is Shotstack's render of the
// same plan (`slideTimelineOf` on the server), so the preview follows its
// rules: clips one after the other, each as long as the others, a fade in
// and out on every clip, the captions over their image, the voice-over
// from the start, cut at the end.

/** A clip of the image track, as the timeline lays it out. */
export interface Clip {
  /** The image's id in the library, which names the clip. */
  readonly id: string;
  readonly index: number;
  /** When it starts, in seconds from the video's start. */
  readonly start: number;
  /** How long it shows, in seconds. */
  readonly length: number;
}

/** The clips of the image track, in order, each as long as the others. */
export const clipsOf = (
  choice: Pick<SlideshowChoice, "secondsPerSlide" | "slides" | "voiceover">
): readonly Clip[] => {
  const length = secondsPerSlideOf(choice);

  return choice.slides.map((slide, index) => ({
    id: slide.media.id,
    index,
    length,
    start: index * length,
  }));
};

/** How long the video lasts: the clips end to end. */
export const durationOf = (clips: readonly Clip[]): number => {
  const last = clips.at(-1);

  return last === undefined ? 0 : last.start + last.length;
};

/**
 * The clip that shows at `time`, the last one once the video has ended,
 * or null when there is none.
 */
export const clipAt = (clips: readonly Clip[], time: number): Clip | null =>
  clips.find((clip) => time < clip.start + clip.length) ?? clips.at(-1) ?? null;

/** The time kept within the video: from its start to its end. */
export const clampedTime = (time: number, duration: number): number =>
  Math.min(Math.max(time, 0), duration);

// A fade's length, in seconds, as Shotstack's `fade` lasts; never more
// than half a short clip, so its fade in and out never cross.
const fadeSeconds = 1;

/** What the preview draws of a clip at an instant. */
export interface Frame {
  /** How visible the image and its caption are, 0 to 1. */
  readonly opacity: number;
  /** How much larger than the frame the image is drawn, 1 at rest. */
  readonly scale: number;
  /** How far the image is moved sideways, a share of the frame's width. */
  readonly shift: number;
}

// How far each motion takes the image over its clip, from rest to its
// end: Shotstack's zoom and pan, as near as a preview draws them.
const zoomBy = 0.3;
const panBy = 0.08;

const motions: Readonly<
  Record<SlideMotion, (progress: number) => Omit<Frame, "opacity">>
> = {
  none: () => ({ scale: 1, shift: 0 }),
  slide: (progress) => ({
    scale: 1 + panBy * 2,
    shift: panBy * (1 - 2 * progress),
  }),
  zoomIn: (progress) => ({ scale: 1 + zoomBy * progress, shift: 0 }),
  zoomOut: (progress) => ({ scale: 1 + zoomBy * (1 - progress), shift: 0 }),
};

/**
 * What the preview shows of `clip` at `time`: its motion so far, and its
 * fade in and out when the transition is a fade.
 */
export const frameOf = (
  clip: Clip,
  time: number,
  motion: SlideMotion,
  transition: SlideTransition
): Frame => {
  const into = clampedTime(time - clip.start, clip.length);
  const progress = clip.length === 0 ? 0 : into / clip.length;
  const fade = Math.min(fadeSeconds, clip.length / 2);

  const opacity =
    transition === "fade" && fade > 0
      ? Math.min(1, into / fade, (clip.length - into) / fade)
      : 1;

  return { opacity: Math.max(0, opacity), ...motions[motion](progress) };
};

/** The clip before or after the one at `time`, to step through them. */
export const steppedClip = (
  clips: readonly Clip[],
  time: number,
  by: -1 | 1
): Clip | null => {
  const at = clipAt(clips, time);

  if (at === null) {
    return null;
  }

  // Back from inside a clip goes to its start first, as players do.
  if (by === -1 && time - at.start > 0.5) {
    return at;
  }

  return clips[at.index + by] ?? at;
};

/** The frame's shape, as a Tailwind class, for each aspect. */
export const aspectClasses: Readonly<Record<ImageAspect, string>> = {
  landscape: "aspect-video",
  portrait: "aspect-[9/16]",
  square: "aspect-square",
};

/** A time as a player writes it: minutes, then seconds with a tenth. */
export const clockOf = (seconds: number): string => {
  const tenths = Math.round(Math.max(seconds, 0) * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths % 600) / 10;

  return `${String(minutes)}:${rest.toFixed(1).padStart(4, "0")}`;
};
