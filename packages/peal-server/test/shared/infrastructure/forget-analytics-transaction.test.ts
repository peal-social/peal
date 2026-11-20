// The deletion at PostHog an erasure starts is a message in the erasure's
// own transaction, on a SQL cluster of its own tables: it commits with the
// erasure, or leaves nothing, and nothing is logged for a rollback.
import { randomUUID } from "node:crypto";

import { assert, describe, it } from "@effect/vitest";
import {
  Duration,
  Effect,
  Layer,
  Logger,
  Option,
  Ref,
  References,
  Schedule,
  Schema,
} from "effect";
import { RunnerAddress } from "effect/cluster";
import { SqlClient } from "effect/sql";

import { clusterLayer } from "#app/cluster.ts";
import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import { AnalyticsScope } from "#shared/application/analytics-scope.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { DatabaseLive } from "#shared/infrastructure/database.ts";
import { MigrationsLive } from "#shared/infrastructure/migrations.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";
import {
  ForgetAnalyticsV1Live,
  WorkflowAnalyticsErasures,
} from "#shared/infrastructure/workflows/forget-analytics.ts";
import { sampleUserId as userId } from "#test/shared/product-event-samples.ts";

const Cluster = clusterLayer(
  {
    entityMessagePollInterval: Duration.millis(100),
    entityTerminationTimeout: Duration.zero,
    runnerAddress: Option.some(
      RunnerAddress.make("peal-server-analytics-erasures", 34_432)
    ),
  },
  "test_analytics_erasures"
);

const lines: string[] = [];

const capture = Logger.layer([
  Logger.make(({ fiber, message }) => {
    lines.push(
      JSON.stringify(message),
      JSON.stringify(fiber.getRef(References.CurrentLogAnnotations))
    );
  }),
]);

const asked = Ref.makeUnsafe<readonly (readonly string[])[]>([]);

// PostHog, which deletes whatever it is asked.
const Delivery = Layer.succeed(
  AnalyticsDelivery,
  AnalyticsDelivery.of({
    enabled: true,
    forget: (distinctIds) =>
      Ref.update(asked, (before) => [...before, distinctIds]).pipe(
        Effect.as("deleted" as const)
      ),
    purge: () => Effect.void,
    send: () => Effect.void,
  })
);

const Test = Layer.mergeAll(
  ForgetAnalyticsV1Live.pipe(
    Layer.provideMerge(
      ProductAnalytics.layer.pipe(
        Layer.provideMerge(WorkflowAnalyticsErasures),
        Layer.provide(AnalyticsScope.layerTest),
        Layer.provideMerge(Delivery)
      )
    )
  ),
  TransactionRunnerLive
).pipe(
  Layer.provideMerge(Cluster),
  Layer.provideMerge(MigrationsLive),
  Layer.provideMerge(DatabaseLive)
);

const CountSchema = Schema.Array(Schema.Struct({ count: Schema.Int }));

// The cluster's messages that name this erasure.
const messagesOf = (key: string) =>
  SqlClient.SqlClient.pipe(
    Effect.flatMap(
      (sql) =>
        sql`SELECT count(*)::int AS count FROM test_analytics_erasures_messages WHERE payload LIKE ${`%${key}%`}`
    ),
    Effect.flatMap(Schema.decodeUnknownEffect(CountSchema)),
    Effect.map((rows) => rows[0]?.count ?? 0)
  );

describe("the deletion an erasure starts at PostHog", () => {
  it.live(
    "leaves nothing, and logs nothing, when the erasure rolls back; commits with it otherwise",
    () =>
      Effect.gen(function* inTransaction() {
        const analytics = yield* ProductAnalytics;
        const { transaction } = yield* TransactionRunner;
        const rolledBack = `erasure:${randomUUID()}`;
        const committed = `erasure:${randomUUID()}`;
        const erased = { userIds: [userId], workspaceIds: [] };

        const failure = yield* transaction(
          analytics
            .erase(rolledBack, erased)
            .pipe(Effect.andThen(Effect.fail("the erasure failed" as const)))
        ).pipe(Effect.flip);

        assert.strictEqual(failure, "the erasure failed");

        yield* transaction(analytics.erase(committed, erased));

        // The committed one runs: PostHog is asked once.
        yield* Ref.get(asked).pipe(
          Effect.flatMap((calls) =>
            calls.length > 0 ? Effect.void : Effect.fail("not yet")
          ),
          Effect.retry({ schedule: Schedule.spaced("100 millis"), times: 100 })
        );

        assert.strictEqual(yield* messagesOf(rolledBack), 0);
        assert.isAbove(yield* messagesOf(committed), 0);
        assert.lengthOf(yield* Ref.get(asked), 1);
        assert.notInclude(lines.join("\n"), "peal.erasure.analytics_failed");
        assert.notInclude(lines.join("\n"), "by hand");
      }).pipe(Effect.provide(Layer.merge(Test, capture))),
    60_000
  );
});
