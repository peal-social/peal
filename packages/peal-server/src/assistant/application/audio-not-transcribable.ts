import { Schema } from "effect";

/**
 * The file cannot be transcribed: it is no audio or video (`notAudio`),
 * not ready (`notReady`), or larger than a transcript takes (`tooLarge`).
 */
export class AudioNotTranscribable extends Schema.TaggedError<AudioNotTranscribable>()(
  "AudioNotTranscribable",
  { reason: Schema.Literals(["notAudio", "notReady", "tooLarge"]) }
) {}
