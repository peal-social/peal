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
 * - `editInvalid`: the edit is not a Shotstack Edit that Shotstack's
 *   schema accepts, merges fields, or names a file at an address other
 *   than the workspace's library (`peal:media/<mediaId>`) or, for a font,
 *   Google's font files.
 * - `mediaNotFound`: a `peal:media/` file of the edit is not a ready file
 *   of the workspace's library.
 * - `mediaNotSupported`: a library file the edit names is of a kind its
 *   asset cannot take, such as an audio file as an image.
 * - `editTooLong`: a clip of the edit ends past `maxEditSeconds`.
 * - `editTooLarge`: the edit has more than `maxEditTracks` tracks or
 *   `maxEditClips` clips.
 * - `outputNotSupported`: the edit asks for an output Peal does not
 *   render: another format than MP4, another resolution, aspect or size,
 *   a range, a scaled copy, a loop, a poster, a thumbnail, or more than
 *   30 frames a second.
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
  "editInvalid",
  "mediaNotFound",
  "mediaNotSupported",
  "editTooLong",
  "editTooLarge",
  "outputNotSupported",
]).annotate({ identifier: "SlideshowRejection" });

export type SlideshowRejection = typeof SlideshowRejectionSchema.Type;

/** The slide video cannot be composed as asked: `reason` says why. */
export class SlideshowRequestRejected extends Schema.TaggedError<SlideshowRequestRejected>()(
  "SlideshowRequestRejected",
  { ...errorEnvelope, reason: SlideshowRejectionSchema },
  {
    description:
      "The slide video cannot be composed as asked: a slide's image is not a ready image of the workspace's library (`imageNotFound`) or not a JPEG or a PNG (`imageNotSupported`), the voice-over is not a ready audio file whose length is known (`voiceoverNotFound`), the slides would last longer than a slide video may (`tooLong`), or, fitted to the voice-over, each slide would last more (`voiceoverTooLong`) or less (`voiceoverTooShort`) than a slide may. For an edit: it is not a Shotstack Edit Peal sends (`editInvalid`), a library file it names is not a ready file of the workspace (`mediaNotFound`) or not of a kind its asset takes (`mediaNotSupported`), it lasts too long (`editTooLong`), it has too many tracks or clips (`editTooLarge`), or it asks for an output Peal does not render (`outputNotSupported`). Nothing was asked or counted.",
    httpApiStatus: 422,
  }
) {}
