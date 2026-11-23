import { Schema } from "effect";

/**
 * A slide video, or an edit, that cannot be composed as asked (the
 * contract's `SlideshowRejection`, kept equal by
 * `test/assistant/api/contract.test.ts`). New reasons join the end.
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
      "editInvalid",
      "mediaNotFound",
      "mediaNotSupported",
      "editTooLong",
      "editTooLarge",
      "outputNotSupported",
    ]),
  }
) {}
