// The daily usage snapshot through the server's own composition, sending
// to a fake PostHog: a workspace with a connected account is told as
// workspace_snapshot, one the operator excluded is not. It fails if the
// billing context wires a sink that tells nobody.
import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import {
  ConfigProvider,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Schedule,
} from "effect";
import { RunnerAddress } from "effect/cluster";
import { SqlClient } from "effect/sql";

import { clusterLayer } from "#app/cluster.ts";
import { ProductAnalyticsLive } from "#app/product-analytics.ts";
import { ContextsLive } from "#app/server.ts";
import { SnapshotUsage } from "#billing/application/snapshot-usage.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { DatabaseLive } from "#shared/infrastructure/database.ts";
import { MigrationsLive } from "#shared/infrastructure/migrations.ts";
import { person } from "#test/billing/support.ts";
import { storageSettings } from "#test/media/support.ts";
import {
  capturedEvents,
  fakePostHog,
  FakePostHog,
  postHogSettings,
} from "#test/shared/fake-posthog.ts";
import { ownDatabase } from "#test/shared/own-database.ts";
import { seedChannel } from "#test/workspace/integration/seed.ts";

// Two workspaces next to each other in the snapshot's order, the excluded
// one first: once the other is told, the excluded one was passed.
const prefix = randomUUID().slice(0, 35);

const excluded = WorkspaceIdSchema.make(`${prefix}0`);

const included = WorkspaceIdSchema.make(`${prefix}1`);

const Cluster = clusterLayer(
  {
    entityMessagePollInterval: Duration.millis(100),
    entityTerminationTimeout: Duration.zero,
    runnerAddress: Option.some(
      RunnerAddress.make("peal-server-workspace-snapshot", 34_433)
    ),
  },
  "test_workspace_snapshot"
);

// The server's contexts, product analytics sending to the fake, with the
// one workspace excluded, on a database of the suite's own: the snapshot
// sweeps every workspace and billing account it holds, starts their day
// and purges usage past its days, so on the database the other suites
// share it took their rows while they ran (the meters and days they keep
// at the test clock's epoch, decades past the purge's cutoff).
const Test = Layer.unwrap(
  Effect.gen(function* withPostHog() {
    const posthog = yield* fakePostHog;

    return ContextsLive.pipe(
      Layer.provideMerge(ProductAnalyticsLive),
      Layer.provide(storageSettings),
      Layer.provide(Cluster),
      Layer.provideMerge(MigrationsLive),
      Layer.provideMerge(DatabaseLive),
      Layer.provide(
        ConfigProvider.layerAdd(
          ConfigProvider.fromUnknown({
            ...postHogSettings(posthog),
            PEAL_POSTHOG_EXCLUDED_IDS: excluded,
            // The media folder of its database.
            PEAL_S3_KEY_PREFIX: "tests/snapshot/",
          }),
          { asPrimary: true }
        )
      ),
      Layer.provide(ownDatabase("snapshot")),
      Layer.merge(Layer.succeed(FakePostHog, posthog))
    );
  })
);

// A workspace made two days ago, owned by one person (so the sweep gives
// it a billing account of theirs), with one connected account.
const seedWorkspace = Effect.fn("seedWorkspace")(function* seedWorkspace(
  workspaceId: WorkspaceId,
  owner: UserId
) {
  const sql = yield* SqlClient.SqlClient;

  const at = DateTime.formatIso(
    DateTime.subtract(yield* DateTime.now, { days: 2 })
  );

  yield* sql`INSERT INTO auth.organization (id, name, slug, created_at) VALUES (${workspaceId}, 'Synthetic snapshot', ${`snapshot-${workspaceId}`}, ${at})`;
  yield* sql`INSERT INTO auth.member (organization_id, user_id, role, created_at) VALUES (${workspaceId}, ${owner}, 'owner', ${at})`;
  yield* seedChannel(workspaceId, `snapshot-${workspaceId}`);
});

const forget = Effect.fn("forget")(function* forget(
  workspaceIds: readonly WorkspaceId[],
  owner: UserId
) {
  const sql = yield* SqlClient.SqlClient;
  const ids = workspaceIds.join(",");

  yield* sql`DELETE FROM channels.channels WHERE workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])`;
  yield* sql`DELETE FROM billing.usage_days WHERE workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])`;
  yield* sql`DELETE FROM billing.account_workspaces WHERE workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])`;
  yield* sql`DELETE FROM billing.accounts WHERE holder_workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])`;
  yield* sql`DELETE FROM billing.accounts WHERE payer_user_id = ${owner}`;
  yield* sql`DELETE FROM auth.organization WHERE id = ANY(string_to_array(${ids}, ',')::uuid[])`;
  yield* sql`DELETE FROM auth.user WHERE id = ${owner}`;
});

const snapshotsOf = (workspaceId: WorkspaceId) =>
  capturedEvents.pipe(
    Effect.map((events) =>
      events.filter(
        (event) =>
          event.event === "workspace_snapshot" &&
          event.properties["workspace_id"] === workspaceId
      )
    )
  );

layer(Test, { excludeTestServices: true, timeout: "300 seconds" })(
  "the daily usage snapshot told to product analytics",
  (it) => {
    it.effect(
      "sends a workspace with a connected account, and none of an excluded one",
      () =>
        Effect.gen(function* snapshot() {
          const owner = yield* person;

          yield* seedWorkspace(excluded, owner);
          yield* seedWorkspace(included, owner);

          const run = yield* SnapshotUsage.use((usage) => usage.run);

          // The snapshot's events are paced: on a database with many
          // workspaces, this one may wait its turn.
          const [told, ...more] = yield* snapshotsOf(included).pipe(
            Effect.flatMap((found) =>
              found.length > 0 ? Effect.succeed(found) : Effect.fail(found)
            ),
            Effect.retry({
              schedule: Schedule.spaced("500 millis"),
              times: 480,
            }),
            Effect.orElseSucceed(() => [])
          );

          assert.lengthOf(more, 0);
          assert.strictEqual(told?.distinct_id, `workspace:${included}`);
          assert.strictEqual(
            told?.properties["day"],
            DateTime.formatIsoDateUtc(run.day)
          );
          assert.strictEqual(told?.properties["channels"], 1);
          assert.strictEqual(told?.properties["members"], 1);
          assert.isString(told?.properties["billing_account_id"]);

          assert.lengthOf(yield* snapshotsOf(excluded), 0);

          yield* forget([excluded, included], owner);
        }),
      300_000
    );
  }
);
