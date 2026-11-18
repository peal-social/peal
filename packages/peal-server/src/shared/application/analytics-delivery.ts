import { Context, Effect, Layer } from "effect";

import type { SafeProperties } from "#shared/domain/product-event.ts";

/** An event as product analytics sends it: checked, and about someone. */
export interface OutgoingEvent {
  /** The user's id, or `workspace:<id>` for a workspace's service identity. */
  readonly distinctId: string;
  /** The event's name: one of the catalogue's, `$identify` or `$groupidentify`. */
  readonly event: string;
  readonly properties: SafeProperties;
}

/**
 * Where product analytics events go: PostHog, when the operator named a
 * project, or nowhere. `ProductAnalytics` decides what is sent; this port
 * only carries it.
 */
export class AnalyticsDelivery extends Context.Service<
  AnalyticsDelivery,
  {
    /** Whether events go anywhere: when not, nothing is built or kept. */
    readonly enabled: boolean;
    /** Queues the event and returns at once. Never fails, never waits on the network. */
    readonly send: (event: OutgoingEvent) => Effect.Effect<void>;
    /** Deletes these persons and their events at the provider. Never fails. */
    readonly forget: (distinctIds: readonly string[]) => Effect.Effect<void>;
  }
>()("peal-server/shared/application/AnalyticsDelivery") {
  /** Nothing is sent: the default of a server without a key, and of tests. */
  static readonly none = Layer.succeed(
    AnalyticsDelivery,
    AnalyticsDelivery.of({
      enabled: false,
      forget: () => Effect.void,
      send: () => Effect.void,
    })
  );
}
