import { Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  AssistantInputRejected,
  CurrentMember,
  VideoAllowanceReached,
  VideoBusy,
  VideoGenerationNotFound,
  VideoRequestRejected,
  VideoUnavailable,
} from "peal-contract";

import { AssistantVideos } from "#assistant/application/assistant-videos.ts";
import type { VideoGeneration } from "#assistant/domain/video-generation.ts";
import { actorOf } from "#shared/api/actor.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";

/** A job as the contract answers it: absent values as null, never its prompt. */
export const videoGenerationOf = (generation: VideoGeneration) => ({
  aspect: generation.aspect,
  createdAt: generation.createdAt,
  durationSeconds: Option.getOrNull(generation.durationSeconds),
  finishedAt: Option.getOrNull(generation.finishedAt),
  id: generation.id,
  imageMediaId: Option.getOrNull(generation.imageMediaId),
  mediaId: Option.getOrNull(generation.mediaId),
  reason: Option.getOrNull(generation.reason),
  startedAt: Option.getOrNull(generation.startedAt),
  status: generation.status,
});

const notFound = () => Effect.fail(new VideoGenerationNotFound());

export const VideoGenerationsHandlers = HttpApiBuilder.group(
  Api,
  "media.videos",
  Effect.fn(function* videoGenerationsHandlers(handlers) {
    const videos = yield* AssistantVideos;
    const limitReached = yield* limitRefusal;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* create() {
          const actor = actorOf(yield* CurrentMember);

          const generation = yield* videos
            .request(actor, {
              aspect: payload.aspect,
              durationSeconds: payload.durationSeconds ?? null,
              imageMediaId: payload.imageMediaId ?? null,
              prompt: payload.prompt,
            })
            .pipe(
              Effect.catchTags({
                DraftRejected: ({ maxLength, reason }) =>
                  Effect.fail(
                    new AssistantInputRejected({ maxLength, reason })
                  ),
                MissingPermission: forbidden,
                PlanLimitReached: limitReached,
                VideoBusy: ({ generationId }) =>
                  Effect.fail(new VideoBusy({ generationId })),
                VideoRejected: ({ reason }) =>
                  Effect.fail(new VideoRequestRejected({ reason })),
                VideosExhausted: ({ dailyLimit, resetsAt }) =>
                  Effect.fail(
                    new VideoAllowanceReached({ dailyLimit, resetsAt })
                  ),
                VideoUnavailable: ({ reason }) =>
                  Effect.fail(new VideoUnavailable({ reason })),
              })
            );

          return videoGenerationOf(generation);
        }),
      get: ({ params }) =>
        Effect.gen(function* get() {
          const actor = actorOf(yield* CurrentMember);

          const generation = yield* videos
            .view(actor, params.generationId)
            .pipe(
              Effect.catchTags({
                MissingPermission: forbidden,
                VideoGenerationNotFound: notFound,
              })
            );

          return videoGenerationOf(generation);
        }),
      list: ({ query }) =>
        Effect.gen(function* list() {
          const actor = actorOf(yield* CurrentMember);

          const generations = yield* videos
            .list(actor, Option.fromUndefinedOr(query.status))
            .pipe(Effect.catchTag("MissingPermission", forbidden));

          return { generations: generations.map(videoGenerationOf) };
        }),
    });
  })
);
