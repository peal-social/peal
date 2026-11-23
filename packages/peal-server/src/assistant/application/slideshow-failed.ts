import { Schema } from "effect";

import { SlideshowFailureReasonSchema } from "#assistant/domain/slideshow.ts";

/**
 * No video came of a slide video's job, for `reason` alone: it carries no
 * cause, as the service's error can quote the captions and the files'
 * links.
 */
export class SlideshowFailed extends Schema.TaggedError<SlideshowFailed>()(
  "SlideshowFailed",
  { reason: SlideshowFailureReasonSchema }
) {}
