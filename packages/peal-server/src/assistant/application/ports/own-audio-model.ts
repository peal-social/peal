import { Context } from "effect";
import type { Effect, Option, Redacted } from "effect";

import type { AudioFailed } from "#assistant/application/audio-failed.ts";
import type {
  SpeechProviderId,
  TranscriptionProviderId,
} from "#assistant/domain/audio-provider.ts";
import type { VoiceoverText } from "#assistant/domain/audio-use.ts";
import type { ProviderAddress } from "#assistant/domain/image-provider.ts";

/** Where a workspace's speech provider is, with its key and model. */
export interface SpeechEndpoint {
  readonly apiKey: Redacted.Redacted;
  readonly baseUrl: ProviderAddress;
  readonly model: string;
  readonly provider: SpeechProviderId;
}

/** Where a workspace's transcription provider is, with its key and model. */
export interface TranscriptionEndpoint {
  readonly apiKey: Redacted.Redacted;
  readonly baseUrl: ProviderAddress;
  readonly model: string;
  readonly provider: TranscriptionProviderId;
}

/** A voice-over's bytes, as the provider gave them. */
export interface Voiceover {
  readonly bytes: Uint8Array;
}

/** What was said in a file, as the provider wrote it. */
export interface Transcription {
  readonly durationSeconds: Option.Option<number>;
  readonly language: Option.Option<string>;
  readonly text: string;
}

/**
 * The speech and transcription models of a workspace's own providers,
 * with its keys: one call each, never sent again, its failures
 * `AudioFailed` by reason alone.
 */
export class OwnAudioModel extends Context.Service<
  OwnAudioModel,
  {
    readonly speak: (
      endpoint: SpeechEndpoint,
      request: {
        readonly text: VoiceoverText;
        readonly voice: Option.Option<string>;
      }
    ) => Effect.Effect<Voiceover, AudioFailed>;
    readonly transcribe: (
      endpoint: TranscriptionEndpoint,
      audio: Uint8Array
    ) => Effect.Effect<Transcription, AudioFailed>;
  }
>()("peal-server/assistant/application/OwnAudioModel") {}
