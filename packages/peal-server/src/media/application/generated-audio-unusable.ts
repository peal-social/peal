import { Schema } from "effect";

/**
 * The bytes a provider answered for a voice-over are not an audio file
 * the library takes: not MP3, M4A or WAV, larger than one may be, or not
 * readable as one. Nothing of them is kept.
 */
export class GeneratedAudioUnusable extends Schema.TaggedError<GeneratedAudioUnusable>()(
  "GeneratedAudioUnusable",
  {}
) {}
