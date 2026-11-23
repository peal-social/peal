import { Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  CompositionAllowanceReached,
  CompositionBusy,
  CompositionNeedsPayment,
  CompositionUnavailable,
  CurrentMember,
  SlideshowNotFound,
  SlideshowRequestRejected,
} from "peal-contract";

import { AssistantSlideshows } from "#assistant/application/assistant-slideshows.ts";
import type { Slideshow } from "#assistant/domain/slideshow.ts";
import { actorOf } from "#shared/api/actor.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";
import { UpgradePaths } from "#shared/application/upgrade-paths.ts";

/** A job as the contract answers it: absent values as null, never its captions. */
export const slideshowOf = (slideshow: Slideshow) => ({
  aspect: slideshow.aspect,
  createdAt: slideshow.createdAt,
  durationSeconds: slideshow.durationSeconds,
  finishedAt: Option.getOrNull(slideshow.finishedAt),
  id: slideshow.id,
  imageMediaIds: [...slideshow.imageMediaIds],
  mediaId: Option.getOrNull(slideshow.mediaId),
  reason: Option.getOrNull(slideshow.reason),
  sandbox: slideshow.sandbox,
  startedAt: Option.getOrNull(slideshow.startedAt),
  status: slideshow.status,
  voiceoverMediaId: Option.getOrNull(slideshow.voiceoverMediaId),
});

const notFound = () => Effect.fail(new SlideshowNotFound());

export const SlideshowsHandlers = HttpApiBuilder.group(
  Api,
  "slideshows",
  Effect.fn(function* slideshowsHandlers(handlers) {
    const slideshows = yield* AssistantSlideshows;
    const paths = yield* UpgradePaths;
    const limitReached = yield* limitRefusal;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* create() {
          const actor = actorOf(yield* CurrentMember);

          const slideshow = yield* slideshows
            .request(actor, {
              aspect: payload.aspect,
              secondsPerSlide: payload.secondsPerSlide ?? null,
              slides: payload.slides.map((slide) => ({
                caption: slide.caption ?? null,
                mediaId: slide.mediaId,
                motion: slide.motion ?? "none",
              })),
              transition: payload.transition ?? "fade",
              voiceoverMediaId: payload.voiceoverMediaId ?? null,
            })
            .pipe(
              Effect.catchTags({
                CompositionBusy: ({ slideshowId }) =>
                  Effect.fail(new CompositionBusy({ slideshowId })),
                CompositionNeedsPayment: () =>
                  paths
                    .paid(actor.workspaceId)
                    .pipe(
                      Effect.flatMap(({ billingUrl }) =>
                        Effect.fail(new CompositionNeedsPayment({ billingUrl }))
                      )
                    ),
                CompositionUnavailable: ({ reason }) =>
                  Effect.fail(new CompositionUnavailable({ reason })),
                MissingPermission: forbidden,
                PlanLimitReached: limitReached,
                SlideshowRejected: ({ reason }) =>
                  Effect.fail(new SlideshowRequestRejected({ reason })),
                SlideshowsExhausted: ({ dailyLimit, resetsAt }) =>
                  Effect.fail(
                    new CompositionAllowanceReached({ dailyLimit, resetsAt })
                  ),
              })
            );

          return slideshowOf(slideshow);
        }),
      get: ({ params }) =>
        Effect.gen(function* get() {
          const actor = actorOf(yield* CurrentMember);

          const slideshow = yield* slideshows
            .view(actor, params.slideshowId)
            .pipe(
              Effect.catchTags({
                MissingPermission: forbidden,
                SlideshowNotFound: notFound,
              })
            );

          return slideshowOf(slideshow);
        }),
      list: ({ query }) =>
        Effect.gen(function* list() {
          const actor = actorOf(yield* CurrentMember);

          const found = yield* slideshows
            .list(actor, Option.fromUndefinedOr(query.status))
            .pipe(Effect.catchTag("MissingPermission", forbidden));

          return { slideshows: found.map(slideshowOf) };
        }),
    });
  })
);
