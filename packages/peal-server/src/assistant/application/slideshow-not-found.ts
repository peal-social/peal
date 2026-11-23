import { Schema } from "effect";

/** No slide video of the workspace has this id. */
export class SlideshowNotFound extends Schema.TaggedError<SlideshowNotFound>()(
  "SlideshowNotFound",
  {}
) {}
