import { Schema } from "effect";

import { SlideshowIdSchema } from "#assistant/domain/slideshow.ts";

/** The workspace has a slide video on the way already: one at a time. */
export class CompositionBusy extends Schema.TaggedError<CompositionBusy>()(
  "CompositionBusy",
  { slideshowId: SlideshowIdSchema }
) {}
