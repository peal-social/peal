import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import {
  Context,
  DateTime,
  Effect,
  Exit,
  Layer,
  Metric,
  Option,
  Schedule,
  Scope,
} from "effect";

import { UsageSnapshotSink } from "#billing/application/ports/usage-snapshot-sink.ts";
import type { ToldDayState } from "#billing/application/ports/usage-snapshot-sink.ts";
import { analyticsUsageSnapshotSink } from "#billing/infrastructure/analytics-usage-snapshot-sink.ts";
import {
  ProductAnalytics,
  productAnalyticsEvents,
} from "#shared/application/product-analytics.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { aloneAccountId } from "#test/billing/support.ts";
import { sampleWorkspaceId as workspaceId } from "#test/shared/product-event-samples.ts";
import {
  clearRecorded,
  recordedAnalytics,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";

const yesterday = DateTime.makeUnsafe("2026-11-10T00:00:00Z");

// Two at a time, every 300 milliseconds: slow enough to see the pace.
const SinkTest = analyticsUsageSnapshotSink({
  batch: 2,
  pause: "300 millis",
}).pipe(Layer.provideMerge(recordedAnalytics));

const stateOf = (channels: number): ToldDayState => ({
  billingAccountId: Option.none(),
  counters: Option.none(),
  state: {
    assistantRequests: 0,
    channels,
    mediaStorage: 0,
    members: 1,
    workspaceId: WorkspaceIdSchema.make(randomUUID()),
  },
});

// The events sent, once there are `count`.
const sentAtLeast = (count: number) =>
  sentEvents.pipe(
    Effect.flatMap((sent) =>
      sent.length >= count ? Effect.succeed(sent) : Effect.fail(sent)
    ),
    Effect.retry({ schedule: Schedule.spaced("20 millis"), times: 250 })
  );

const dropped = Metric.value(
  Metric.withAttributes(productAnalyticsEvents, { outcome: "dropped" })
).pipe(Effect.map(({ count }) => count));

layer(SinkTest, { excludeTestServices: true })(
  "the snapshot's days told to product analytics",
  (it) => {
    it.effect(
      "sends each as workspace_snapshot, as the workspace, with its billing account",
      () =>
        Effect.gen(function* told() {
          yield* clearRecorded;

          const sink = yield* UsageSnapshotSink;

          assert.isTrue(sink.enabled);

          yield* sink.told(yesterday, [
            {
              billingAccountId: Option.some(aloneAccountId),
              counters: Option.some({
                assistantImages: 1,
                managedAds: 0,
                outboundMessages: 5,
                publishedPosts: 7,
              }),
              state: {
                assistantRequests: 4,
                channels: 3,
                mediaStorage: 9_000_000_000,
                members: 2,
                workspaceId,
              },
            },
          ]);

          const [sent, ...more] = yield* sentAtLeast(1);

          assert.lengthOf(more, 0);
          assert.strictEqual(sent?.event, "workspace_snapshot");
          assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
          assert.deepStrictEqual(sent?.properties, {
            $geoip_disable: true,
            $groups: {
              billing_account: aloneAccountId,
              workspace: workspaceId,
            },
            $set_once: { kind: "service" },
            actor_kind: "service",
            assistant_images: 1,
            assistant_requests: 4,
            billing_account_id: aloneAccountId,
            channels: 3,
            day: "2026-11-10",
            environment: "test",
            managed_ads: 0,
            media_storage_bytes: 9_000_000_000,
            members: 2,
            outbound_messages: 5,
            published_posts: 7,
            workspace_id: workspaceId,
          });
        })
    );

    it.effect("sends one without an account when none was read", () =>
      Effect.gen(function* unread() {
        yield* clearRecorded;

        yield* UsageSnapshotSink.use((sink) =>
          sink.told(yesterday, [stateOf(1)])
        );

        const [sent] = yield* sentAtLeast(1);

        assert.strictEqual(sent?.event, "workspace_snapshot");
        assert.isUndefined(sent?.properties["billing_account_id"]);
        assert.deepStrictEqual(Object.keys(sent?.properties["$groups"] ?? {}), [
          "workspace",
        ]);
      })
    );

    it.effect(
      "returns at once and hands the events over at its pace, in order",
      () =>
        Effect.gen(function* paced() {
          yield* clearRecorded;

          const states = Array.from({ length: 5 }, (_, index) =>
            stateOf(index + 1)
          );

          yield* UsageSnapshotSink.use((sink) => sink.told(yesterday, states));

          // The first two at once, then the pause before the next two.
          const first = yield* sentAtLeast(2);

          assert.isAtMost(first.length, 2);

          const all = yield* sentAtLeast(5);

          assert.deepStrictEqual(
            all.map(({ properties }) => properties["channels"]),
            [1, 2, 3, 4, 5]
          );
        })
    );
  }
);

layer(analyticsUsageSnapshotSink().pipe(Layer.provide(ProductAnalytics.none)))(
  "the snapshot's days with product analytics off",
  (it) => {
    it.effect("tells nothing", () =>
      Effect.gen(function* off() {
        const sink = yield* UsageSnapshotSink;

        assert.isFalse(sink.enabled);
        yield* sink.told(yesterday, [stateOf(1)]);
      })
    );
  }
);

layer(recordedAnalytics, { excludeTestServices: true })(
  "the snapshot's days as the server stops",
  (it) => {
    it.effect("counts what still waits as dropped", () =>
      Effect.gen(function* stopping() {
        const before = yield* dropped;
        const scope = yield* Scope.make();

        // Nothing more is handed over before the scope closes.
        const built = yield* Layer.buildWithScope(
          analyticsUsageSnapshotSink({ batch: 1, pause: "1 hour" }).pipe(
            Layer.provide(
              Layer.succeedContext(yield* Effect.context<ProductAnalytics>())
            )
          ),
          scope
        );

        yield* Context.get(built, UsageSnapshotSink).told(
          yesterday,
          Array.from({ length: 4 }, () => stateOf(1))
        );

        yield* sentAtLeast(1);
        yield* Scope.close(scope, Exit.void);

        assert.strictEqual((yield* dropped) - before, 3);
      })
    );
  }
);
