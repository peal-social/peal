import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";

import { UsageSnapshotSink } from "#billing/application/ports/usage-snapshot-sink.ts";
import { AnalyticsUsageSnapshotSinkLive } from "#billing/infrastructure/analytics-usage-snapshot-sink.ts";
import { aloneAccountId } from "#test/billing/support.ts";
import { sampleWorkspaceId as workspaceId } from "#test/shared/product-event-samples.ts";
import {
  clearRecorded,
  recordedAnalytics,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";

const SinkTest = AnalyticsUsageSnapshotSinkLive.pipe(
  Layer.provideMerge(recordedAnalytics)
);

const yesterday = DateTime.makeUnsafe("2026-11-10T00:00:00Z");

layer(SinkTest)("the snapshot's days told to product analytics", (it) => {
  it.effect(
    "sends each as workspace_snapshot, as the workspace, with its billing account",
    () =>
      Effect.gen(function* told() {
        yield* clearRecorded;

        yield* UsageSnapshotSink.use((sink) =>
          sink.told(yesterday, [
            {
              billingAccountId: Option.some(aloneAccountId),
              state: {
                assistantRequests: 4,
                channels: 3,
                mediaStorage: 9_000_000_000,
                members: 2,
                workspaceId,
              },
            },
          ])
        );

        const [sent, ...more] = yield* sentEvents;

        assert.lengthOf(more, 0);
        assert.strictEqual(sent?.event, "workspace_snapshot");
        assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
        assert.deepStrictEqual(sent?.properties, {
          $geoip_disable: true,
          $groups: { billing_account: aloneAccountId, workspace: workspaceId },
          $set: { kind: "service" },
          actor_kind: "service",
          assistant_requests: 4,
          billing_account_id: aloneAccountId,
          channels: 3,
          day: "2026-11-10",
          environment: "test",
          media_storage_bytes: 9_000_000_000,
          members: 2,
          workspace_id: workspaceId,
        });
      })
  );

  it.effect("sends one without an account when none was read", () =>
    Effect.gen(function* unread() {
      yield* clearRecorded;

      yield* UsageSnapshotSink.use((sink) =>
        sink.told(yesterday, [
          {
            billingAccountId: Option.none(),
            state: {
              assistantRequests: 0,
              channels: 1,
              mediaStorage: 0,
              members: 1,
              workspaceId,
            },
          },
        ])
      );

      const [sent] = yield* sentEvents;

      assert.strictEqual(sent?.event, "workspace_snapshot");
      assert.isUndefined(sent?.properties["billing_account_id"]);
      assert.deepStrictEqual(sent?.properties["$groups"], {
        workspace: workspaceId,
      });
    })
  );
});
