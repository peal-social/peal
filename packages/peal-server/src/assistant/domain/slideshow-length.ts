import { Result } from "effect";

import {
  defaultSecondsPerSlide,
  maxSecondsPerSlide,
  maxSlideshowSeconds,
  minSecondsPerSlide,
} from "./slideshow-limits.ts";
import { SlideshowRejected } from "./slideshow-rejected.ts";

/** How long a slide video lasts: each slide, and in all, in seconds. */
export interface SlideshowLength {
  readonly secondsPerSlide: number;
  readonly totalSeconds: number;
}

// Milliseconds are as fine as a timeline takes.
const toMillis = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/**
 * How long each slide shows: the seconds asked, else the voice-over's
 * length shared between the slides, else `defaultSecondsPerSlide`. The
 * whole lasts `maxSlideshowSeconds` at most (`tooLong`); fitted to a
 * voice-over, each slide lasts `minSecondsPerSlide` to
 * `maxSecondsPerSlide` (`voiceoverTooShort`, `voiceoverTooLong`), and a
 * voice-over longer than a slide video may is `voiceoverTooLong`.
 */
export const slideshowLengthOf = ({
  secondsPerSlide,
  slides,
  voiceoverSeconds,
}: {
  readonly secondsPerSlide: number | null;
  readonly slides: number;
  readonly voiceoverSeconds: number | null;
}): Result.Result<SlideshowLength, SlideshowRejected> => {
  if (secondsPerSlide === null && voiceoverSeconds !== null) {
    const fitted = toMillis(voiceoverSeconds / slides);

    if (fitted < minSecondsPerSlide) {
      return Result.fail(
        new SlideshowRejected({ reason: "voiceoverTooShort" })
      );
    }

    if (fitted > maxSecondsPerSlide || voiceoverSeconds > maxSlideshowSeconds) {
      return Result.fail(new SlideshowRejected({ reason: "voiceoverTooLong" }));
    }

    return Result.succeed({
      secondsPerSlide: fitted,
      totalSeconds: toMillis(fitted * slides),
    });
  }

  const each = secondsPerSlide ?? defaultSecondsPerSlide;
  const total = each * slides;

  return total > maxSlideshowSeconds
    ? Result.fail(new SlideshowRejected({ reason: "tooLong" }))
    : Result.succeed({ secondsPerSlide: each, totalSeconds: total });
};
