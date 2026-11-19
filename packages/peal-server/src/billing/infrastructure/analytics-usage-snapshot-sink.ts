import type { Duration } from "effect";
import { DateTime, Effect, Layer, Option, Queue } from "effect";

import { UsageSnapshotSink } from "#billing/application/ports/usage-snapshot-sink.ts";
import type { ToldDayState } from "#billing/application/ports/usage-snapshot-sink.ts";
import {
  countEvents,
  ProductAnalytics,
} from "#shared/application/product-analytics.ts";
import type { Captured } from "#shared/application/product-analytics.ts";
import {
  maxBatch,
  sendPause,
} from "#shared/infrastructure/posthog-delivery.ts";

/** How fast the snapshot's events are handed to product analytics. */
export interface SnapshotPace {
  /** Events handed over at once, at most. */
  readonly batch: number;
  /** The wait after each handover. */
  readonly pause: Duration.Input;
}

/**
 * Half what the delivery sends (`maxBatch` every `sendPause`): the day's
 * snapshots never fill its queue, whatever the number of workspaces, and
 * leave room for every other event meanwhile.
 */
export const snapshotPace: SnapshotPace = {
  batch: maxBatch / 2,
  pause: sendPause,
};

const capturedOf = (
  day: DateTime.Utc,
  { billingAccountId, state }: ToldDayState
): Captured => ({
  actor: Option.none(),
  asWorkspace: true,
  billingAccountId,
  event: {
    name: "workspace_snapshot",
    properties: {
      assistantRequests: state.assistantRequests,
      channels: state.channels,
      day: DateTime.formatIsoDateUtc(day),
      mediaStorageBytes: state.mediaStorage,
      members: state.members,
    },
  },
  workspaceId: Option.some(state.workspaceId),
});

/**
 * The daily snapshot's days, told to product analytics as
 * `workspace_snapshot`, one event a workspace, sent as its service
 * identity (what the snapshot read is stored data, never a person acting)
 * with its billing account when it was read: numbers and the day only.
 * Telling only queues them: a fiber of the layer hands them over `pace`
 * allows, so a day of many workspaces never overflows the delivery's
 * queue, and what still waits when the server stops is counted dropped.
 * Capture leaves out a workspace the operator excluded or one erased in
 * this process. Off with product analytics, it tells nothing.
 */
export const analyticsUsageSnapshotSink = (pace: SnapshotPace = snapshotPace) =>
  Layer.effect(
    UsageSnapshotSink,
    Effect.gen(function* AnalyticsUsageSnapshotSink() {
      const analytics = yield* ProductAnalytics;

      if (!analytics.enabled) {
        return UsageSnapshotSink.of({
          enabled: false,
          told: () => Effect.void,
        });
      }

      const waiting = yield* Queue.unbounded<Captured>();

      yield* Queue.takeBetween(waiting, 1, pace.batch).pipe(
        Effect.flatMap((batch) =>
          Effect.forEach(batch, analytics.capture, { discard: true })
        ),
        Effect.andThen(Effect.sleep(pace.pause)),
        Effect.forever,
        Effect.forkScoped
      );

      yield* Effect.addFinalizer(() =>
        Queue.clear(waiting).pipe(
          Effect.flatMap((left) => countEvents("dropped", left.length)),
          Effect.ignore
        )
      );

      return UsageSnapshotSink.of({
        enabled: true,
        told: (day, states) =>
          Queue.offerAll(
            waiting,
            states.map((told) => capturedOf(day, told))
          ).pipe(Effect.asVoid),
      });
    })
  );

/** The sink at its default pace. */
export const AnalyticsUsageSnapshotSinkLive = analyticsUsageSnapshotSink();
