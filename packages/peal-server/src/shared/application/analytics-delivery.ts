import { Context, Effect, Layer } from "effect";

import type { SafeProperties } from "#shared/domain/product-event.ts";

import type { AnalyticsErasureFailed } from "./analytics-erasure-failed.ts";

/** An event as product analytics sends it: checked, and about someone. */
export interface OutgoingEvent {
  /** The user's id, or `workspace:<id>` for a workspace's service identity. */
  readonly distinctId: string;
  /** The event's name: one of the catalogue's, `$identify` or `$groupidentify`. */
  readonly event: string;
  readonly properties: SafeProperties;
}

/**
 * What deleting persons did: `deleted` at the provider, or `manual`, left
 * for the operator to delete by hand (no key to delete with), logged.
 */
export type ErasureOutcome = "deleted" | "manual";

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
    /**
     * Drops what waits to be sent about these persons, and waits for a
     * request in flight to end, so nothing sent after it makes them again.
     */
    readonly purge: (distinctIds: readonly string[]) => Effect.Effect<void>;
    /** Deletes these persons and their events at the provider, once. */
    readonly forget: (
      distinctIds: readonly string[]
    ) => Effect.Effect<ErasureOutcome, AnalyticsErasureFailed>;
  }
>()("peal-server/shared/application/AnalyticsDelivery") {
  /**
   * Nothing is sent: the default of a server without a key, and of tests.
   * A deletion still asked of it (one a server started before its key was
   * removed) is logged for the operator to make by hand, never dropped.
   */
  static readonly none = Layer.succeed(
    AnalyticsDelivery,
    AnalyticsDelivery.of({
      enabled: false,
      forget: (distinctIds) =>
        Effect.logWarning(
          "An erasure's persons stay at PostHog without PEAL_POSTHOG_KEY: delete them there by hand"
        ).pipe(
          Effect.annotateLogs({
            distinctIds: distinctIds.join(","),
            "event.name": "peal.erasure.analytics_manual",
          }),
          Effect.as<ErasureOutcome>("manual")
        ),
      purge: () => Effect.void,
      send: () => Effect.void,
    })
  );
}
