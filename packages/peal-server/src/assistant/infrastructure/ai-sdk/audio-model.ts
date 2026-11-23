import { generateSpeech, transcribe } from "ai";
import { Effect, flow, Option, Schema } from "effect";

import { AudioCallFailed } from "./audio-call-failed.ts";
import { speechModelOf, transcriptionModelOf } from "./models.ts";
import type {
  ProviderFetch,
  SpeechModelSettings,
  TranscriptionModelSettings,
} from "./models.ts";
import { providerStatusOf } from "./provider-status.ts";

/** What a voice-over is made of: the text, and a voice when one is named. */
export interface SpeechCall {
  readonly text: string;
  readonly voice: Option.Option<string>;
}

/** A voice-over as the provider gave it: its bytes, and their type when told. */
export interface SpokenAudio {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
}

/** A transcript as the provider gave it. */
export interface Transcribed {
  readonly durationSeconds: Option.Option<number>;
  readonly language: Option.Option<string>;
  readonly text: string;
}

// What Peal reads of the SDK's error: its name and status, and the
// provider's answer only to tell a wrong key (`providerStatusOf`); never
// its message or the request's body.
const SdkFailureSchema = Schema.Struct({
  name: Schema.String,
  responseBody: Schema.optional(Schema.String),
  statusCode: Schema.optional(Schema.Number),
});

type SdkFailure = typeof SdkFailureSchema.Type;

const readFailure = Schema.decodeUnknownOption(SdkFailureSchema);

// The failures that say the answer held no audio or transcript the SDK
// could read, or that what it pointed to could not be fetched.
const unusable: ReadonlySet<string> = new Set([
  "AI_DownloadError",
  "AI_InvalidResponseDataError",
  "AI_JSONParseError",
  "AI_NoSpeechGeneratedError",
  "AI_NoTranscriptGeneratedError",
  "AI_TypeValidationError",
]);

// A fetch that threw (the guard refused the address, the connection
// failed, the fetch's own bound passed) or was aborted.
const unsent: ReadonlySet<string> = new Set([
  "AbortError",
  "TimeoutError",
  "TypeError",
]);

const failed = (kind: AudioCallFailed["kind"], status: number | null = null) =>
  new AudioCallFailed({ kind, status });

/** The SDK's failure as an AudioCallFailed, by its name and status alone. */
const failureOf = (failure: Option.Option<SdkFailure>): AudioCallFailed =>
  Option.match(failure, {
    onNone: () => failed("refused"),
    onSome: ({ name, responseBody, statusCode }) => {
      if (name === "AI_APICallError") {
        if (statusCode === undefined) {
          return failed("unsent");
        }

        // A success whose body could not be read, or went past the
        // fetch's bound.
        return statusCode >= 200 && statusCode <= 299
          ? failed("unusable")
          : failed("status", providerStatusOf(statusCode, responseBody));
      }

      if (unusable.has(name)) {
        return failed("unusable");
      }

      return unsent.has(name) ? failed("unsent") : failed("refused");
    },
  });

/**
 * One voice-over from the provider `settings` name, through the AI SDK's
 * `generateSpeech`: the text, the voice when one is named (else the
 * provider's own default), the provider's default format, the SDK's
 * retries off (`maxRetries: 0`), its telemetry off, and the fiber's abort
 * signal, so interrupting the call aborts its request. Every request (and
 * the audio an answer links to, which carries no key) goes through
 * `fetch`. The provider's package is built for this call alone. It
 * answers the audio's bytes and the type the SDK read in them, or
 * AudioCallFailed by the kind of failure: the SDK's error is never kept,
 * logged or traced.
 */
export const generateSpeechWith = (
  settings: SpeechModelSettings,
  fetch: ProviderFetch,
  { text, voice }: SpeechCall
): Effect.Effect<SpokenAudio, AudioCallFailed> =>
  Effect.tryPromise({
    catch: flow(readFailure, failureOf),
    try: async (abortSignal) => {
      const options: Parameters<typeof generateSpeech>[0] = {
        abortSignal,
        maxRetries: 0,
        model: speechModelOf(settings, fetch),
        telemetry: { isEnabled: false },
        text,
      };

      if (Option.isSome(voice)) {
        options.voice = voice.value;
      }

      const { audio } = await generateSpeech(options);

      return { bytes: audio.uint8Array, mediaType: audio.mediaType };
    },
  });

/**
 * The transcript of one file from the provider `settings` name, through
 * the AI SDK's `transcribe`: the file's bytes as they are stored, the
 * SDK's retries off, its telemetry off, the fiber's abort signal. Every
 * request goes through `fetch`; the package is built for this call alone.
 * It answers the text, the language and the duration the provider gave,
 * or AudioCallFailed by the kind of failure, never kept, logged or
 * traced.
 */
export const transcribeWith = (
  settings: TranscriptionModelSettings,
  fetch: ProviderFetch,
  audio: Uint8Array
): Effect.Effect<Transcribed, AudioCallFailed> =>
  Effect.tryPromise({
    catch: flow(readFailure, failureOf),
    try: async (abortSignal) => {
      const transcript = await transcribe({
        abortSignal,
        audio,
        maxRetries: 0,
        model: transcriptionModelOf(settings, fetch),
        telemetry: { isEnabled: false },
      });

      return {
        durationSeconds: Option.fromUndefinedOr(transcript.durationInSeconds),
        language: Option.fromUndefinedOr(transcript.language),
        text: transcript.text,
      };
    },
  });
