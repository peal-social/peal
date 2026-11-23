import { Context, Effect, Layer, Semaphore } from "effect";

import { slideshowsAtOnce } from "#assistant/domain/slideshow-limits.ts";

/**
 * The slide videos this server composes at once (`slideshowsAtOnce`): a
 * job waits its turn here, still queued, as each holds a video in memory.
 */
export class SlideshowSlots extends Context.Service<
  SlideshowSlots,
  {
    readonly withSlot: <A, E, R>(
      effect: Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E, R>;
  }
>()("peal-server/assistant/application/SlideshowSlots") {
  static readonly layer = Layer.effect(
    SlideshowSlots,
    Effect.gen(function* SlideshowSlotsLive() {
      const slots = yield* Semaphore.make(slideshowsAtOnce);

      return SlideshowSlots.of({
        withSlot: (effect) => Semaphore.withPermit(slots, effect),
      });
    })
  );
}
