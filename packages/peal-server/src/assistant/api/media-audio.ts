import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  AssistantInputRejected,
  AudioAllowanceReached,
  AudioProviderFailed,
  AudioUnavailable,
  CurrentMember,
  MediaNotFound,
  MediaStoreUnavailable,
  TranscriptionRejected,
  VoiceNotOffered,
} from "peal-contract";

import { AssistantAudio } from "#assistant/application/assistant-audio.ts";
import { maxTranscriptionBytes } from "#assistant/domain/audio-limits.ts";
import { actorOf } from "#shared/api/actor.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";

/**
 * Voice-overs and transcripts, from the providers the workspace chose
 * for them: each refusal of the use case as the contract's error.
 */
export const MediaAudioHandlers = HttpApiBuilder.group(
  Api,
  "mediaAudio",
  Effect.fn(function* mediaAudioHandlers(handlers) {
    const audio = yield* AssistantAudio;
    const limitReached = yield* limitRefusal;

    const shared = {
      AudioExhausted: ({
        capability,
        dailyLimit,
        resetsAt,
      }: {
        readonly capability: "speech" | "transcription";
        readonly dailyLimit: number;
        readonly resetsAt: AudioAllowanceReached["resetsAt"];
      }) =>
        Effect.fail(
          new AudioAllowanceReached({ capability, dailyLimit, resetsAt })
        ),
      AudioFailed: ({
        capability,
        reason,
      }: {
        readonly capability: "speech" | "transcription";
        readonly reason: AudioProviderFailed["reason"];
      }) => Effect.fail(new AudioProviderFailed({ capability, reason })),
      AudioNotStored: () => Effect.fail(new MediaStoreUnavailable()),
      AudioUnavailable: ({
        capability,
        reason,
      }: {
        readonly capability: "speech" | "transcription";
        readonly reason: "keyUnreadable" | "notSet";
      }) => Effect.fail(new AudioUnavailable({ capability, reason })),
      MissingPermission: forbidden,
    };

    return handlers.handleAll({
      createVoiceover: ({ payload }) =>
        Effect.gen(function* createVoiceover() {
          const actor = actorOf(yield* CurrentMember);

          return yield* audio
            .voiceover(actor, {
              text: payload.text,
              voice: payload.voice ?? null,
            })
            .pipe(
              Effect.catchTags({
                ...shared,
                DraftRejected: ({ maxLength, reason }) =>
                  Effect.fail(
                    new AssistantInputRejected({ maxLength, reason })
                  ),
                PlanLimitReached: limitReached,
                VoiceNotOffered: () => Effect.fail(new VoiceNotOffered()),
              })
            );
        }),
      transcribe: ({ params, payload }) =>
        Effect.gen(function* transcribe() {
          const actor = actorOf(yield* CurrentMember);

          return yield* audio
            .transcribe(actor, params.mediaId, {
              saveAsDescription: payload.saveAsDescription ?? false,
            })
            .pipe(
              Effect.catchTags({
                ...shared,
                AudioMediaNotFound: () => Effect.fail(new MediaNotFound()),
                AudioNotTranscribable: ({ reason }) =>
                  Effect.fail(
                    new TranscriptionRejected({
                      maxBytes: maxTranscriptionBytes,
                      reason,
                    })
                  ),
              })
            );
        }),
    });
  })
);
