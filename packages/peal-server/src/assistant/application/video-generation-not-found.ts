import { Schema } from "effect";

/** The workspace asked for no video with this id. */
export class VideoGenerationNotFound extends Schema.TaggedError<VideoGenerationNotFound>()(
  "VideoGenerationNotFound",
  {}
) {}
