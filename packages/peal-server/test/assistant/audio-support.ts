import { Context, DateTime, Effect, Layer, Option, Ref } from "effect";
import { SqlClient } from "effect/sql";

import { AssistantAudio } from "#assistant/application/assistant-audio.ts";
import { AudioFailed } from "#assistant/application/audio-failed.ts";
import { AudioMediaNotFound } from "#assistant/application/audio-media-not-found.ts";
import { AudioNotTranscribable } from "#assistant/application/audio-not-transcribable.ts";
import { AudioLibrary } from "#assistant/application/ports/audio-library.ts";
import type { GeneratedAudio } from "#assistant/application/ports/audio-library.ts";
import { OwnAudioModel } from "#assistant/application/ports/own-audio-model.ts";
import type {
  SpeechEndpoint,
  TranscriptionEndpoint,
} from "#assistant/application/ports/own-audio-model.ts";
import type { AudioFailureReason } from "#assistant/domain/audio-use.ts";
import { DrizzleOwnAudioCountsLive } from "#assistant/infrastructure/drizzle-own-audio-counts.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/** What the audio use cases sent and kept. */
export class AudioRecords extends Context.Service<
  AudioRecords,
  {
    /** Each voice-over asked: the endpoint, the text and the voice. */
    readonly spoken: Ref.Ref<
      readonly {
        readonly endpoint: SpeechEndpoint;
        readonly text: string;
        readonly voice: Option.Option<string>;
      }[]
    >;
    /** Each transcript asked: the endpoint and the bytes sent. */
    readonly transcribed: Ref.Ref<
      readonly {
        readonly audio: Uint8Array;
        readonly endpoint: TranscriptionEndpoint;
      }[]
    >;
    /** The voice-overs kept in the library. */
    readonly stored: Ref.Ref<readonly Uint8Array[]>;
    /** The descriptions saved, by media id. */
    readonly described: Ref.Ref<readonly (readonly [string, string])[]>;
  }
>()("test/assistant/AudioRecords") {
  static readonly layer = Layer.effect(
    AudioRecords,
    Effect.gen(function* AudioRecordsLive() {
      return AudioRecords.of({
        described: yield* Ref.make<readonly (readonly [string, string])[]>([]),
        spoken: yield* Ref.make<
          readonly {
            readonly endpoint: SpeechEndpoint;
            readonly text: string;
            readonly voice: Option.Option<string>;
          }[]
        >([]),
        stored: yield* Ref.make<readonly Uint8Array[]>([]),
        transcribed: yield* Ref.make<
          readonly {
            readonly audio: Uint8Array;
            readonly endpoint: TranscriptionEndpoint;
          }[]
        >([]),
      });
    })
  );
}

/** How the providers and the library behave in a test. */
export interface AudioScript {
  /** Why the provider fails, when it does. */
  readonly fails?: AudioFailureReason;
  /** The files of the library, by id: their bytes, or why they are refused. */
  readonly files?: ReadonlyMap<
    string,
    Uint8Array | AudioNotTranscribable["reason"]
  >;
  /** Whether the plan has room for the largest voice-over. */
  readonly room?: boolean;
  /** The transcript the provider answers. */
  readonly transcript?: string;
}

/** The synthetic voice-over the fake provider answers. */
export const syntheticVoiceover = new Uint8Array([0x49, 0x44, 0x33, 4, 0]);

/** The id a test's voice-over is kept as. */
export const storedAudioId = "019a0000-0000-7000-8000-00000000a0d1";

const fullPlan = () =>
  new PlanLimitReached({
    allowed: 1000,
    limit: "mediaStorage",
    needed: 2000,
    used: 1000,
  });

const keptAudio = (bytes: Uint8Array): GeneratedAudio => {
  const at = DateTime.makeUnsafe("2026-11-22T12:00:00Z");

  return {
    aiGenerated: true,
    altText: null,
    byteSize: bytes.byteLength,
    codec: "mp3",
    contentType: "audio/mpeg",
    createdAt: at,
    dimensions: null,
    durationMs: 1000,
    fileName: null,
    id: storedAudioId,
    kind: "audio",
    pageCount: null,
    status: { _tag: "ready" },
    updatedAt: at,
    url: null,
  };
};

/** The provider and the library as the script says, recording what they do. */
export const audioPortsTest = ({
  fails,
  files = new Map(),
  room = true,
  transcript = "A synthetic transcript.",
}: AudioScript = {}) =>
  Layer.mergeAll(
    Layer.effect(
      OwnAudioModel,
      AudioRecords.use((records) =>
        Effect.succeed(
          OwnAudioModel.of({
            speak: (endpoint, { text, voice }) =>
              Ref.update(records.spoken, (all) => [
                ...all,
                { endpoint, text, voice },
              ]).pipe(
                Effect.andThen(
                  fails === undefined
                    ? Effect.succeed({ bytes: syntheticVoiceover })
                    : Effect.fail(
                        new AudioFailed({ capability: "speech", reason: fails })
                      )
                )
              ),
            transcribe: (endpoint, audio) =>
              Ref.update(records.transcribed, (all) => [
                ...all,
                { audio, endpoint },
              ]).pipe(
                Effect.andThen(
                  fails === undefined
                    ? Effect.succeed({
                        durationSeconds: Option.some(3),
                        language: Option.some("en"),
                        text: transcript,
                      })
                    : Effect.fail(
                        new AudioFailed({
                          capability: "transcription",
                          reason: fails,
                        })
                      )
                )
              ),
          })
        )
      )
    ),
    Layer.effect(
      AudioLibrary,
      AudioRecords.use((records) =>
        Effect.succeed(
          AudioLibrary.of({
            describe: (_, mediaId, text) =>
              files.has(mediaId)
                ? Ref.update(records.described, (all) => [
                    ...all,
                    [mediaId, text] as const,
                  ]).pipe(Effect.as(text.length <= 1500))
                : Effect.fail(new AudioMediaNotFound()),
            read: (_, mediaId) => {
              const file = files.get(mediaId);

              if (file === undefined) {
                return Effect.fail(new AudioMediaNotFound());
              }

              return file instanceof Uint8Array
                ? Effect.succeed(file)
                : Effect.fail(new AudioNotTranscribable({ reason: file }));
            },
            roomFor: () => (room ? Effect.void : Effect.fail(fullPlan())),
            store: (_, bytes) =>
              Ref.update(records.stored, (all) => [...all, bytes]).pipe(
                Effect.as(keptAudio(bytes))
              ),
          })
        )
      )
    ),
    DrizzleOwnAudioCountsLive
  ).pipe(Layer.provideMerge(AudioRecords.layer));

/**
 * AssistantAudio on `audioPortsTest`, for the assistant's endpoints. Needs
 * DatabaseTest and the providers' stores (CapabilityModels,
 * ProviderConnections).
 */
export const assistantAudioTest = (script: AudioScript = {}) =>
  AssistantAudio.layer.pipe(Layer.provideMerge(audioPortsTest(script)));

/** Deletes a workspace's audio counts when the test ends. */
export const forgetAudioOf = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap((sql) =>
      Effect.addFinalizer(() =>
        sql`DELETE FROM assistant.own_audio_days WHERE workspace_id = ${workspaceId}`.pipe(
          Effect.ignore
        )
      )
    )
  );
