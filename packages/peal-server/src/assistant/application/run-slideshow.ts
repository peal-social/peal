import { Context, DateTime, Effect, Layer, Option } from "effect";

import { openCompositionUse } from "#assistant/application/composition-uses.ts";
import type { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { OwnComposer } from "#assistant/application/ports/own-composer.ts";
import type { ComposedSlide } from "#assistant/application/ports/own-composer.ts";
import type { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { SlideshowMedia } from "#assistant/application/ports/slideshow-media.ts";
import { SlideshowNotices } from "#assistant/application/ports/slideshow-notices.ts";
import { SlideshowSlots } from "#assistant/application/ports/slideshow-slots.ts";
import { SlideshowStore } from "#assistant/application/ports/slideshow-store.ts";
import type {
  ClaimedSlideshow,
  SlideshowOutcome,
} from "#assistant/application/ports/slideshow-store.ts";
import { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import { sourceLinkLifetime } from "#assistant/domain/slideshow-limits.ts";
import type { SlideshowId } from "#assistant/domain/slideshow.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";

/**
 * How a run left its job: it ended (`succeeded`, `failed`), or there was
 * nothing to run (`superseded`: the job ended already, or went with its
 * workspace).
 */
export type SlideshowRunResult = "failed" | "succeeded" | "superseded";

const failed = (reason: SlideshowFailed["reason"]) =>
  new SlideshowFailed({ reason });

/**
 * Runs one slide video's job, for the workflow its request started. The
 * job is its own journal: a run takes it from `queued` to `running`
 * before it asks anything, and a run that finds it `running` already (the
 * server stopped while the service composed it) fails it `interrupted`
 * and asks nothing, as the service may have rendered and billed it.
 * Nothing is ever sent again.
 */
export class RunSlideshow extends Context.Service<
  RunSlideshow,
  { readonly run: (id: SlideshowId) => Effect.Effect<SlideshowRunResult> }
>()("peal-server/assistant/application/RunSlideshow") {
  static readonly layer = Layer.effect(
    RunSlideshow,
    Effect.gen(function* RunSlideshowLive() {
      const store = yield* SlideshowStore;
      const notices = yield* SlideshowNotices;
      const slots = yield* SlideshowSlots;
      const media = yield* SlideshowMedia;
      const composer = yield* OwnComposer;
      const { transaction } = yield* TransactionRunner;

      const ports = yield* Effect.context<
        CapabilityModels | ProviderConnections
      >();

      // Ends the job, unless it ended meanwhile, and tells who asked: in
      // one transaction.
      const settle = (id: SlideshowId, outcome: SlideshowOutcome) =>
        DateTime.now.pipe(
          Effect.flatMap((now) =>
            transaction(
              store.settle(id, outcome, now).pipe(
                Effect.tap((ended) =>
                  Option.match(ended, {
                    onNone: () => Effect.void,
                    onSome: notices.ended,
                  })
                )
              )
            )
          ),
          Effect.catchTag("DatabaseError", Effect.die),
          Effect.map((ended): SlideshowRunResult =>
            Option.isNone(ended) ? "superseded" : outcome._tag
          )
        );

      // A short-lived link to a file of the workspace, for the service.
      const linkTo = (
        workspaceId: ClaimedSlideshow["slideshow"]["workspaceId"],
        assetId: MediaAssetId
      ) =>
        media.linkTo(workspaceId, assetId, sourceLinkLifetime).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(failed("mediaUnavailable")),
              onSome: Effect.succeed,
            })
          )
        );

      // The video, from the service chosen now: the choice may have
      // changed since the request.
      const make = Effect.fn("RunSlideshow.make")(function* make({
        plan,
        slideshow,
      }: ClaimedSlideshow) {
        const { workspaceId } = slideshow;

        const use = yield* openCompositionUse(workspaceId).pipe(
          Effect.provideContext(ports)
        );

        if (use._tag === "notSet") {
          return yield* failed("unavailable");
        }

        if (use._tag === "keyUnreadable") {
          return yield* failed("keyUnreadable");
        }

        yield* media
          .roomFor(workspaceId)
          .pipe(
            Effect.catchTag("PlanLimitReached", () =>
              Effect.fail(failed("storageFull"))
            )
          );

        // Links only for this request's files, each working for an hour.
        const slides = yield* Effect.all(
          plan.slides.map((slide) =>
            linkTo(workspaceId, slide.mediaId).pipe(
              Effect.map((imageUrl): ComposedSlide => ({
                caption: slide.caption,
                imageUrl,
                motion: slide.motion,
              }))
            )
          )
        );

        const voiceoverUrl = Option.isSome(slideshow.voiceoverMediaId)
          ? yield* linkTo(workspaceId, slideshow.voiceoverMediaId.value)
          : null;

        const bytes = yield* composer.compose(use.endpoint, {
          aspect: slideshow.aspect,
          secondsPerSlide: plan.secondsPerSlide,
          slides,
          transition: plan.transition,
          voiceoverUrl,
        });

        return yield* media.store(workspaceId, bytes);
      });

      // A run that breaks (a bug, never the service's error, which the
      // adapter reads by its status alone) fails its job, logged without
      // what it held.
      const made = (
        claimed: ClaimedSlideshow
      ): Effect.Effect<SlideshowOutcome> =>
        make(claimed).pipe(
          Effect.map((mediaId): SlideshowOutcome => ({
            _tag: "succeeded",
            mediaId,
          })),
          Effect.catchTag("SlideshowFailed", ({ reason }) =>
            Effect.succeed<SlideshowOutcome>({ _tag: "failed", reason })
          ),
          Effect.catchDefect(() =>
            Effect.logError("A slide video's job broke: it is failed").pipe(
              Effect.as<SlideshowOutcome>({
                _tag: "failed",
                reason: "interrupted",
              })
            )
          )
        );

      const run = Effect.fn("RunSlideshow.run")(function* run(id: SlideshowId) {
        const found = yield* store.find(id);

        if (Option.isNone(found)) {
          return "superseded" as const;
        }

        const { status } = found.value;

        if (status === "succeeded" || status === "failed") {
          return "superseded" as const;
        }

        // Sent before, by a run that never ended: never sent again.
        if (status === "running") {
          return yield* settle(id, { _tag: "failed", reason: "interrupted" });
        }

        return yield* slots.withSlot(
          Effect.gen(function* running() {
            const claimed = yield* store.claim(id, yield* DateTime.now);

            if (Option.isNone(claimed)) {
              return "superseded" as const;
            }

            return yield* settle(id, yield* made(claimed.value));
          })
        );
      });

      return RunSlideshow.of({ run });
    })
  );
}
