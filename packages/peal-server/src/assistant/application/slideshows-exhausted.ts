import { Schema } from "effect";

/**
 * The workspace asked for `slideshowsPerDay` slide videos today (UTC): no
 * more until the day ends, whatever each ended with.
 */
export class SlideshowsExhausted extends Schema.TaggedError<SlideshowsExhausted>()(
  "SlideshowsExhausted",
  { dailyLimit: Schema.Int, resetsAt: Schema.DateTimeUtc }
) {}
