import { Schema } from "effect";

import { AudioCapabilitySchema } from "#assistant/domain/audio-use.ts";

/**
 * The workspace asked for as many voice-overs or transcripts today (UTC)
 * as a day allows: no more until the day ends, whatever each ended with.
 */
export class AudioExhausted extends Schema.TaggedError<AudioExhausted>()(
  "AudioExhausted",
  {
    capability: AudioCapabilitySchema,
    dailyLimit: Schema.Int,
    resetsAt: Schema.DateTimeUtc,
  }
) {}
