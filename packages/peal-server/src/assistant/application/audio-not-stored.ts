import { Schema } from "effect";

/**
 * The media store failed to keep a voice-over, or to hand out a file to
 * transcribe: the store's failure was logged where it happened.
 */
export class AudioNotStored extends Schema.TaggedError<AudioNotStored>()(
  "AudioNotStored",
  {}
) {}
