import { DateTime, Effect, Layer, Option } from "effect";

import { UsageSnapshotSink } from "#billing/application/ports/usage-snapshot-sink.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";

/**
 * The daily snapshot's days, told to product analytics as
 * `workspace_snapshot`, one event a workspace, sent as its service
 * identity (what the snapshot read is stored data, never a person acting)
 * with its billing account when it was read: numbers and the day only.
 * Capture never fails or waits on the network, and leaves out a workspace
 * the operator excluded or one erased in this process.
 */
export const AnalyticsUsageSnapshotSinkLive = Layer.effect(
  UsageSnapshotSink,
  Effect.gen(function* AnalyticsUsageSnapshotSink() {
    const analytics = yield* ProductAnalytics;

    return UsageSnapshotSink.of({
      told: (day, states) =>
        Effect.forEach(
          states,
          ({ billingAccountId, state }) =>
            analytics.capture({
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
            }),
          { discard: true }
        ),
    });
  })
);
