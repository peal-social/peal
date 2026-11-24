import { Duration } from "effect";

/**
 * How many slide videos a workspace may ask for each UTC day, whatever
 * each ends with: the workspace's own service account pays, so this
 * bounds what a workspace holds of the server's memory and store. The
 * contract's `slideshowsPerDay` repeats it.
 */
export const slideshowsPerDay = 20;

/**
 * How many slide videos a server composes at once: each holds a video in
 * memory, up to `maxSlideshowBytes`, until it is stored. Past it, a job
 * waits its turn, still `queued`.
 */
export const slideshowsAtOnce = 4;

/** How many slides a video holds, at least and at most. */
export const minSlides = 2;

export const maxSlides = 10;

/** The longest caption of a slide, in UTF-16 code units. */
export const maxSlideCaptionLength = 120;

/** How long a slide shows, in seconds, at least and at most. */
export const minSecondsPerSlide = 2;

export const maxSecondsPerSlide = 10;

/** How long a slide shows when neither the request nor a voice-over says. */
export const defaultSecondsPerSlide = 4;

/** The longest slide video, in seconds. */
export const maxSlideshowSeconds = 90;

/**
 * What an edit rendered as a whole may hold: every clip whose start and
 * length are numbers ends by `maxEditSeconds`, in at most `maxEditTracks`
 * tracks and `maxEditClips` clips in all. The contract repeats them.
 */
export const maxEditSeconds = 300;

export const maxEditTracks = 20;

export const maxEditClips = 200;

/**
 * The largest video Peal keeps from the service: 90 seconds of 1080p are
 * far less. Larger is `unusableAnswer`; the plan's storage must have room
 * for it before anything is asked.
 */
export { maxVideoBytes as maxSlideshowBytes } from "./video-limits.ts";

/**
 * How often Peal reads where a render stands: the service's guide polls
 * every 5 seconds, and renders about 20 seconds a minute of video.
 */
export const slideshowPollInterval = Duration.seconds(5);

/**
 * How long Peal waits for a render, its download included; past it the job
 * fails `timedOut`, which the service may still bill.
 */
export const slideshowTimeout = Duration.minutes(20);

/**
 * How long the links the service fetches the workspace's files from work:
 * past the longest wait, never for good.
 */
export const sourceLinkLifetime = Duration.hours(1);

/**
 * A job still queued or running this long after it was asked for was
 * lost: it is failed `interrupted` when the workspace next asks for one,
 * so it no longer holds the workspace's turn.
 */
export const staleSlideshowAfter = Duration.minutes(40);
