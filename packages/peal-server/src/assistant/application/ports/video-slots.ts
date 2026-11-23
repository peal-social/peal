import { Context, Effect, Layer, Semaphore } from "effect";

import { videosAtOnce } from "#assistant/domain/video-limits.ts";

/**
 * The videos this server makes at once (`videosAtOnce`): a job waits its
 * turn here, still queued, as each holds a video in memory.
 */
export class VideoSlots extends Context.Service<
  VideoSlots,
  {
    readonly withSlot: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>;
  }
>()("peal-server/assistant/application/VideoSlots") {
  static readonly layer = Layer.effect(
    VideoSlots,
    Effect.gen(function* VideoSlotsLive() {
      const slots = yield* Semaphore.make(videosAtOnce);

      return VideoSlots.of({
        withSlot: (effect) => Semaphore.withPermit(slots, effect),
      });
    })
  );
}
