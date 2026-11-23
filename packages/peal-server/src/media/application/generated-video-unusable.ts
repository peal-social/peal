import { Schema } from "effect";

/**
 * The bytes a provider answered for a generated video are not a video the
 * library takes: not MP4 or QuickTime, larger than a video may be, or not
 * readable as one. Nothing of them is kept.
 */
export class GeneratedVideoUnusable extends Schema.TaggedError<GeneratedVideoUnusable>()(
  "GeneratedVideoUnusable",
  {}
) {}
