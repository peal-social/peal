import { Schema } from "effect";

import {
  AudioCapabilitySchema,
  AudioFailureReasonSchema,
} from "#assistant/domain/audio-use.ts";

/**
 * The workspace's provider gave no voice-over or no transcript, for
 * `reason` alone: it carries no cause, as the provider's error holds the
 * request's body, with the text or the audio, and the provider's words.
 */
export class AudioFailed extends Schema.TaggedError<AudioFailed>()(
  "AudioFailed",
  { capability: AudioCapabilitySchema, reason: AudioFailureReasonSchema }
) {}
