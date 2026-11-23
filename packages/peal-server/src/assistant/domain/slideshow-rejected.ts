import { Schema } from "effect";

/**
 * A slide video that cannot be composed as asked (the contract's
 * `SlideshowRejection`).
 */
export class SlideshowRejected extends Schema.TaggedError<SlideshowRejected>()(
  "SlideshowRejected",
  {
    reason: Schema.Literals([
      "imageNotFound",
      "imageNotSupported",
      "voiceoverNotFound",
      "tooLong",
      "voiceoverTooLong",
      "voiceoverTooShort",
    ]),
  }
) {}
