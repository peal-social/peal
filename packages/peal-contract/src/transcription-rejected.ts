import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The file cannot be transcribed: it is no audio or video (`notAudio`),
 * it is not ready yet (`notReady`), or it is larger than a transcript
 * takes (`tooLarge`, past `maxBytes`).
 */
export class TranscriptionRejected extends Schema.TaggedError<TranscriptionRejected>()(
  "TranscriptionRejected",
  {
    ...errorEnvelope,
    // The largest file a transcript is made of, in bytes.
    maxBytes: Schema.Int,
    reason: Schema.Literals(["notAudio", "notReady", "tooLarge"]),
  },
  {
    description:
      "The file is no audio or video (`notAudio`), is not ready yet (`notReady`: wait until it is), or is larger than a transcript takes (`tooLarge`: at most `maxBytes`). Nothing was asked or counted.",
    httpApiStatus: 422,
  }
) {}
