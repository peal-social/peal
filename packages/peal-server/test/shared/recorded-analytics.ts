import { Context, Effect, Layer, Ref } from "effect";

import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import type { OutgoingEvent } from "#shared/application/analytics-delivery.ts";
import { AnalyticsScope } from "#shared/application/analytics-scope.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";

/** What a recording delivery was handed, in order. */
export class RecordedAnalytics extends Context.Service<
  RecordedAnalytics,
  {
    readonly sent: Ref.Ref<readonly OutgoingEvent[]>;
    readonly forgotten: Ref.Ref<readonly string[]>;
  }
>()("test/shared/RecordedAnalytics") {}

/**
 * A delivery that is on and keeps what it is handed, with
 * `RecordedAnalytics` to read it: the state lives in the layer, so each
 * `layer(...)` block starts empty.
 */
export const recordedDelivery = Layer.effectContext(
  Effect.gen(function* recording() {
    const sent = yield* Ref.make<readonly OutgoingEvent[]>([]);
    const forgotten = yield* Ref.make<readonly string[]>([]);

    return Context.make(
      AnalyticsDelivery,
      AnalyticsDelivery.of({
        enabled: true,
        forget: (distinctIds) =>
          Ref.update(forgotten, (before) => [...before, ...distinctIds]),
        send: (event) => Ref.update(sent, (before) => [...before, event]),
      })
    ).pipe(
      Context.add(RecordedAnalytics, RecordedAnalytics.of({ forgotten, sent }))
    );
  })
);

/**
 * ProductAnalytics over a recording delivery, in the `test` environment
 * with nobody excluded, and RecordedAnalytics to read what it sent.
 */
export const recordedAnalytics = ProductAnalytics.layer.pipe(
  Layer.provide(AnalyticsScope.layerTest),
  Layer.provideMerge(recordedDelivery)
);

/** The events handed to the delivery so far. */
export const sentEvents = RecordedAnalytics.use(({ sent }) => Ref.get(sent));

/** The events of this name handed to the delivery so far. */
export const sentNamed = (name: string) =>
  sentEvents.pipe(
    Effect.map((events) => events.filter((event) => event.event === name))
  );

/** The distinct ids the delivery was asked to forget so far. */
export const forgotten = RecordedAnalytics.use(({ forgotten: ids }) =>
  Ref.get(ids)
);

/** Forgets what was recorded, between tests of one block. */
export const clearRecorded = RecordedAnalytics.use(({ forgotten: ids, sent }) =>
  Ref.set(sent, []).pipe(Effect.andThen(Ref.set(ids, [])))
);
