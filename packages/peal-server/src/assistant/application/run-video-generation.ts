import { Context, DateTime, Effect, Layer, Option, Result } from "effect";

import type { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { GeneratedVideos } from "#assistant/application/ports/generated-videos.ts";
import { OwnVideoModel } from "#assistant/application/ports/own-video-model.ts";
import type { FirstFrame } from "#assistant/application/ports/own-video-model.ts";
import type { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import { VideoGenerationStore } from "#assistant/application/ports/video-generation-store.ts";
import type {
  ClaimedVideo,
  VideoOutcome,
} from "#assistant/application/ports/video-generation-store.ts";
import { VideoNotices } from "#assistant/application/ports/video-notices.ts";
import { VideoSlots } from "#assistant/application/ports/video-slots.ts";
import { VideoFailed } from "#assistant/application/video-failed.ts";
import { openVideoUse } from "#assistant/application/video-uses.ts";
import type { VideoGenerationId } from "#assistant/domain/video-generation.ts";
import { checkVideoAsk } from "#assistant/domain/video-provider.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";

/**
 * How a run left its job: it ended (`succeeded`, `failed`), or there was
 * nothing to run (`superseded`: the job ended already, or went with its
 * workspace).
 */
export type VideoRunResult = "failed" | "succeeded" | "superseded";

const failed = (reason: VideoFailed["reason"]) => new VideoFailed({ reason });

/**
 * Runs one video job, for the workflow its request started. The job is
 * its own journal: a run takes it from `queued` to `running` before it
 * asks anything, and a run that finds it `running` already (the server
 * stopped while the provider made it) fails it `interrupted` and asks
 * nothing, as the provider may have made and billed it. Nothing is ever
 * tried again.
 */
export class RunVideoGeneration extends Context.Service<
  RunVideoGeneration,
  { readonly run: (id: VideoGenerationId) => Effect.Effect<VideoRunResult> }
>()("peal-server/assistant/application/RunVideoGeneration") {
  static readonly layer = Layer.effect(
    RunVideoGeneration,
    Effect.gen(function* RunVideoGenerationLive() {
      const store = yield* VideoGenerationStore;
      const notices = yield* VideoNotices;
      const slots = yield* VideoSlots;
      const videos = yield* GeneratedVideos;
      const model = yield* OwnVideoModel;
      const { transaction } = yield* TransactionRunner;

      const ports = yield* Effect.context<
        CapabilityModels | ProviderConnections
      >();

      // Ends the job, unless it ended meanwhile, and tells who asked: in
      // one transaction.
      const settle = (id: VideoGenerationId, outcome: VideoOutcome) =>
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
          Effect.map((ended): VideoRunResult => {
            if (Option.isNone(ended)) {
              return "superseded";
            }

            return outcome._tag;
          })
        );

      // The video, from the provider chosen now: the choice may have
      // changed since the request, which was checked against the one then.
      const make = Effect.fn("RunVideoGeneration.make")(function* make({
        generation,
        prompt,
      }: ClaimedVideo) {
        const { workspaceId } = generation;

        const use = yield* openVideoUse(workspaceId).pipe(
          Effect.provideContext(ports)
        );

        if (use._tag === "notSet") {
          return yield* failed("unavailable");
        }

        if (use._tag === "keyUnreadable") {
          return yield* failed("keyUnreadable");
        }

        const durationSeconds = Option.getOrNull(generation.durationSeconds);

        const ratio = checkVideoAsk(use.endpoint.provider, {
          aspect: generation.aspect,
          durationSeconds,
          withImage: Option.isSome(generation.imageMediaId),
        });

        if (Result.isFailure(ratio)) {
          return yield* failed("refused");
        }

        let image = Option.none<FirstFrame>();

        if (Option.isSome(generation.imageMediaId)) {
          image = yield* videos.firstFrame(
            workspaceId,
            generation.imageMediaId.value
          );

          if (Option.isNone(image)) {
            return yield* failed("imageUnavailable");
          }
        }

        yield* videos
          .roomFor(workspaceId)
          .pipe(
            Effect.catchTag("PlanLimitReached", () =>
              Effect.fail(failed("storageFull"))
            )
          );

        const bytes = yield* model.generate(use.endpoint, {
          durationSeconds,
          image,
          prompt,
          ratio: ratio.success,
        });

        return yield* videos.store(workspaceId, bytes);
      });

      // A run that breaks (a bug, never the provider's error, which the
      // adapter reads by its name alone) fails its job, logged without
      // what it held.
      const made = (claimed: ClaimedVideo): Effect.Effect<VideoOutcome> =>
        make(claimed).pipe(
          Effect.map((mediaId): VideoOutcome => ({
            _tag: "succeeded",
            mediaId,
          })),
          Effect.catchTag("VideoFailed", ({ reason }) =>
            Effect.succeed<VideoOutcome>({ _tag: "failed", reason })
          ),
          Effect.catchDefect(() =>
            Effect.logError("A video job broke: it is failed").pipe(
              Effect.as<VideoOutcome>({
                _tag: "failed",
                reason: "interrupted",
              })
            )
          )
        );

      const run = Effect.fn("RunVideoGeneration.run")(function* run(
        id: VideoGenerationId
      ) {
        const found = yield* store.find(id);

        if (Option.isNone(found)) {
          return "superseded" as const;
        }

        const { status } = found.value;

        if (status === "succeeded" || status === "failed") {
          return "superseded" as const;
        }

        // Started before, by a run that never ended: never asked again.
        if (status === "running") {
          return yield* settle(id, { _tag: "failed", reason: "interrupted" });
        }

        // The turn is taken while still queued: only a job with a slot
        // asks anything, and holds a video in memory.
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

      return RunVideoGeneration.of({ run });
    })
  );
}
