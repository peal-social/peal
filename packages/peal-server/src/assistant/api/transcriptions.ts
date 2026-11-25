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
import { changesNoContent } from "#shared/api/change-mark.ts";

import { audioFailures } from "./audio-failures.ts";

/**
 * Transcripts, from the provider the workspace chose for them: each
 * refusal of the use case as the contract's error. A transcript saved as
 * the file's description changes content, as describing the file does.
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

          const transcript = yield* audio
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

          // A transcript only read changes no content: the connection
          // journal leaves it out, and the activity log still keeps it.
          if (!transcript.descriptionSaved) {
            yield* changesNoContent;
          }

          return transcript;
        }),
    });
  })
);
