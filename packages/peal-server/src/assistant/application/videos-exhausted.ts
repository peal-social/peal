import { Schema } from "effect";

/**
 * The workspace asked for `videosPerDay` videos today (UTC): no more until
 * the day ends, whatever each ended with.
 */
export class VideosExhausted extends Schema.TaggedError<VideosExhausted>()(
  "VideosExhausted",
  { dailyLimit: Schema.Int, resetsAt: Schema.DateTimeUtc }
) {}
