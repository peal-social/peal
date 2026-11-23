import { Schema } from "effect";

import { AudioCapabilitySchema } from "#assistant/domain/audio-use.ts";

/**
 * The workspace makes no voice-over or no transcript: it chose no
 * provider and model for the use (`notSet`), or the chosen provider's key
 * no longer opens (`keyUnreadable`).
 */
export class AudioUnavailable extends Schema.TaggedError<AudioUnavailable>()(
  "AudioUnavailable",
  {
    capability: AudioCapabilitySchema,
    reason: Schema.Literals(["notSet", "keyUnreadable"]),
  }
) {}
