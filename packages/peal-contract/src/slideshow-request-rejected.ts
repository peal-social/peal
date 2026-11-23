import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * Why a slide video cannot be composed as asked:
 *
 * - `imageNotFound`: a slide names no ready image of the workspace's
 *   library.
 * - `imageNotSupported`: a slide's image is not a JPEG or a PNG, the
 *   formats the service composes.
 * - `voiceoverNotFound`: `voiceoverMediaId` names no ready audio file of
 *   the workspace's library whose length is known.
 * - `tooLong`: the slides would last longer than a slide video may.
 * - `voiceoverTooLong`: fitted to the voice-over, each slide would last
 *   longer than a slide may, or the whole longer than a slide video may.
 * - `voiceoverTooShort`: fitted to the voice-over, each slide would last
 *   less than a slide must.
 *
 * New reasons join the end of the list.
 */
export const SlideshowRejectionSchema = Schema.Literals([
  "imageNotFound",
  "imageNotSupported",
  "voiceoverNotFound",
  "tooLong",
  "voiceoverTooLong",
  "voiceoverTooShort",
]).annotate({ identifier: "SlideshowRejection" });

export type SlideshowRejection = typeof SlideshowRejectionSchema.Type;

/** The slide video cannot be composed as asked: `reason` says why. */
export class SlideshowRequestRejected extends Schema.TaggedError<SlideshowRequestRejected>()(
  "SlideshowRequestRejected",
  { ...errorEnvelope, reason: SlideshowRejectionSchema },
  {
    description:
      "The slide video cannot be composed as asked: a slide's image is not a ready image of the workspace's library (`imageNotFound`) or not a JPEG or a PNG (`imageNotSupported`), the voice-over is not a ready audio file whose length is known (`voiceoverNotFound`), the slides would last longer than a slide video may (`tooLong`), or, fitted to the voice-over, each slide would last more (`voiceoverTooLong`) or less (`voiceoverTooShort`) than a slide may. Nothing was asked or counted.",
    httpApiStatus: 422,
  }
) {}
