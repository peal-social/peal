import { Schema } from "effect";

/**
 * The workspace makes no video: it chose no provider and model for videos
 * (`notSet`), or the chosen provider's key no longer opens
 * (`keyUnreadable`).
 */
export class VideoUnavailable extends Schema.TaggedError<VideoUnavailable>()(
  "VideoUnavailable",
  { reason: Schema.Literals(["notSet", "keyUnreadable"]) }
) {}
