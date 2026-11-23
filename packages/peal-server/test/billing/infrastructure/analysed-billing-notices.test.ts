// A meter's allowance reached is told to product analytics with the
// notice its billing managers get: the meter and a count, as the billing
// workspace's service identity. No other notice is told, and a notice
// that could not be kept tells nothing.
import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Exit, Layer } from "effect";

import { BillingNotices } from "#billing/application/ports/billing-notices.ts";
import { analysedBillingNotices } from "#billing/infrastructure/analysed-billing-notices.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { sampleWorkspaceId as workspaceId } from "#test/shared/product-event-samples.ts";
import {
  clearRecorded,
  recordedAnalytics,
  sentEvents,
} from "#test/shared/recorded-analytics.ts";

const resetsAt = DateTime.makeUnsafe("2026-12-01T00:00:00.000Z");

// The notices the stub cannot keep: its database fails.
const failing = "allowance:failing";

const Told = Layer.succeed(
  BillingNotices,
  BillingNotices.of({
    tell: ({ key }) =>
      key === failing
        ? Effect.fail(new DatabaseError({ cause: "synthetic" }))
        : Effect.void,
  })
);

const reached = (key: string) =>
  BillingNotices.use((notices) =>
    notices.tell({
      key,
      notice: {
        _tag: "AllowanceReached",
        allowed: 10_000,
        meter: "outboundMessages",
        resetsAt,
      },
      workspaceId,
    })
  );

layer(analysedBillingNotices(Told).pipe(Layer.provideMerge(recordedAnalytics)))(
  "the billing notices product analytics hears",
  (it) => {
    it.effect(
      "tells an allowance reached, as the billing workspace, never when it resets",
      () =>
        Effect.gen(function* allowance() {
          yield* clearRecorded;
          yield* reached(`allowance:${workspaceId}:2026-11:outboundMessages`);

          const [sent, ...more] = yield* sentEvents;

          assert.lengthOf(more, 0);
          assert.strictEqual(sent?.event, "allowance_reached");
          assert.strictEqual(sent?.distinctId, `workspace:${workspaceId}`);
          assert.strictEqual(sent?.properties["actor_kind"], "service");
          assert.strictEqual(sent?.properties["allowed"], 10_000);
          assert.strictEqual(sent?.properties["meter"], "outboundMessages");
          assert.strictEqual(sent?.properties["workspace_id"], workspaceId);
          assert.notProperty(sent?.properties, "resets_at");
        })
    );

    it.effect("tells nothing of the other notices", () =>
      Effect.gen(function* others() {
        yield* clearRecorded;

        yield* BillingNotices.use((notices) =>
          notices.tell({
            key: `x-ceiling:${workspaceId}:2026-11:2500:80`,
            notice: {
              _tag: "XSpendCeiling",
              ceiling: 2500,
              percent: 80,
              resetsAt,
            },
            workspaceId,
          })
        );

        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );

    it.effect("tells nothing when the notice failed, and fails the same", () =>
      Effect.gen(function* failed() {
        yield* clearRecorded;

        const exit = yield* reached(failing).pipe(Effect.exit);

        assert.isTrue(Exit.isFailure(exit));
        assert.deepStrictEqual(yield* sentEvents, []);
      })
    );
  }
);
