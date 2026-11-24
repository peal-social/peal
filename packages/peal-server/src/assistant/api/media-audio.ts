import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  AssistantInputRejected,
  CurrentMember,
  VoiceNotOffered,
} from "peal-contract";

import { AssistantAudio } from "#assistant/application/assistant-audio.ts";
import { actorOf } from "#shared/api/actor.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";

import { audioFailures } from "./audio-failures.ts";

/**
 * Voice-overs, from the provider the workspace chose for them: each
 * refusal of the use case as the contract's error.
 */
export const MediaAudioHandlers = HttpApiBuilder.group(
  Api,
  "media.voiceovers",
  Effect.fn(function* mediaAudioHandlers(handlers) {
    const audio = yield* AssistantAudio;
    const limitReached = yield* limitRefusal;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* createVoiceover() {
          const actor = actorOf(yield* CurrentMember);

          return yield* audio
            .voiceover(actor, {
              text: payload.text,
              voice: payload.voice ?? null,
            })
            .pipe(
              Effect.catchTags({
                ...audioFailures,
                DraftRejected: ({ maxLength, reason }) =>
                  Effect.fail(
                    new AssistantInputRejected({ maxLength, reason })
                  ),
                PlanLimitReached: limitReached,
                VoiceNotOffered: () => Effect.fail(new VoiceNotOffered()),
              })
            );
        }),
    });
  })
);
