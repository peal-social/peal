import { Duration } from "effect";

/**
 * How many videos a workspace may ask for each UTC day, whatever each ends
 * with: they spend none of Peal's allowance, as the workspace's own key
 * pays, so this bounds what a workspace holds of the server's memory and
 * store. The one place to change it (the contract's `videosPerDay`
 * repeats it).
 */
export const videosPerDay = 20;

/**
 * How many videos a server makes at once: each holds a video in memory,
 * up to `maxVideoBytes`, until it is stored. Past it, a job waits its
 * turn, still `queued`. A workspace has one video on the way at most.
 */
export const videosAtOnce = 4;

/**
 * The largest video Peal keeps from a provider: a few seconds of 1080p
 * are tens of megabytes. Larger is `unusableAnswer`, cut off as it is
 * read; the plan's storage must have room for it before anything is asked.
 */
export const maxVideoBytes = 200 * 1024 * 1024;

/**
 * How long Peal waits for a video, its download included. A provider
 * takes minutes; past this the job fails `timedOut`, which the provider
 * may still bill.
 */
export const videoTimeout = Duration.minutes(15);

/**
 * A job still queued or running this long after it was asked for was
 * lost (its server stopped and the job never ran again): it is failed
 * `interrupted` when the workspace next asks for a video, so it no longer
 * holds the workspace's turn.
 */
export const staleVideoAfter = Duration.minutes(30);

/** The longest description of a video, in UTF-16 code units. */
export const maxVideoPromptLength = 1000;
