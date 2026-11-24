import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  CurrentMember,
  MediaNotFound,
  TranscriptionRejected,
} from "peal-contract";

import { AssistantAudio } from "#assistant/application/assistant-audio.ts";
import { maxTranscriptionBytes } from "#assistant/domain/audio-limits.ts";
import { actorOf } from "#shared/api/actor.ts";

import { audioFailures } from "./audio-failures.ts";

/**
 * Transcripts, from the provider the workspace chose for them: each
 * refusal of the use case as the contract's error.
 */
export const MediaTranscriptionsHandlers = HttpApiBuilder.group(
  Api,
  "media.transcriptions",
  Effect.fn(function* mediaTranscriptionsHandlers(handlers) {
    const audio = yield* AssistantAudio;

    return handlers.handleAll({
      create: ({ params, payload }) =>
        Effect.gen(function* transcribe() {
          const actor = actorOf(yield* CurrentMember);

          return yield* audio
            .transcribe(actor, params.mediaId, {
              saveAsDescription: payload.saveAsDescription ?? false,
            })
            .pipe(
              Effect.catchTags({
                ...audioFailures,
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
