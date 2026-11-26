import { Config, Duration, Effect, Layer, Option } from "effect";
import {
  ClusterWorkflowEngine,
  RunnerAddress,
  RunnerHealth,
  Runners,
  Sharding,
  ShardingConfig,
  SingleRunner,
  SqlMessageStorage,
  SqlRunnerStorage,
} from "effect/cluster";
import { Digest } from "effect/crypto";

import { workflowShutdownTimeout } from "#app/shutdown.ts";

// The runner never listens: one server runs every shard, with no transport
// between runners. Its address is only its identity in cluster_runners, which
// also seeds the ids of the messages it writes, so each process needs its own.
// Under Docker, HOSTNAME is the container id.
const runnerPort = 34_431;

const runnerAddress = Config.String("HOSTNAME").pipe(
  Config.withDefault("peal-server"),
  Config.map((host) => RunnerAddress.make(host, runnerPort))
);

type ShardingSettings = Partial<ShardingConfig.ShardingConfig["Service"]>;

/**
 * How many entities the runner holds in memory at once (Effect's default
 * is 10,000): room for every gate of a server with 41,000 channels, the
 * load tests' database, twice over. A gate costs a few kilobytes; a job
 * more, only while it runs.
 */
export const maxResidentEntities = 100_000;

// SingleRunner reads its settings from the environment as well, and its
// runner address from HOST and PORT, which name the HTTP server here. The
// settings below replace whatever those variables say.
const runnerLive = (overrides: ShardingSettings, tablePrefix?: string) =>
  Layer.unwrap(
    Effect.gen(function* RunnerLive() {
      const address = yield* runnerAddress;

      const shardingConfig: ShardingSettings = {
        // A workflow sleeping until its instant wakes on the next poll of
        // storage: this bounds how late a post goes out.
        entityMessagePollInterval: Duration.seconds(2),
        // How long shutdown waits for calls in flight to the platforms.
        entityTerminationTimeout: workflowShutdownTimeout,
        // The entities in memory at once: every workflow running, and every
        // channel's gate called in its last ten minutes. Past the limit the
        // runner takes no message for an entity not already in memory, so
        // nothing new starts, publishing included, however idle the server
        // is. Effect's 10,000 was reached by one collection over more
        // channels than that, and held every post due behind it until the
        // gates it opened went idle (a load test, 2026-11-26).
        maxResidentEntities,
        runnerAddress: Option.some(address),
        ...overrides,
      };

      // Postgres advisory locks on each shard, so a second process started
      // by mistake waits instead of running the same workflows.
      if (tablePrefix === undefined) {
        return SingleRunner.layer({ runnerStorage: "sql", shardingConfig });
      }

      // SingleRunner's layer, on tables (and shard locks) of their own:
      // a test's runner never waits on another's shards.
      return Sharding.layer.pipe(
        Layer.provideMerge(Runners.layerNoop),
        Layer.provideMerge(
          SqlMessageStorage.layerWith({ prefix: tablePrefix })
        ),
        Layer.provide([
          Layer.orDie(SqlRunnerStorage.layerWith({ prefix: tablePrefix })),
          RunnerHealth.layerNoop,
        ]),
        Layer.provide(ShardingConfig.layerFromEnv(shardingConfig))
      );
    })
  );

/**
 * Durable workflows and cluster entities on one server, stored in Postgres
 * next to the application's tables: messages, replies and runners live in the
 * cluster_* tables, which Effect creates and migrates when this layer builds.
 *
 * It needs the SqlClient that the repositories use, so a use case can write
 * its rows and start a workflow in one transaction. Tests pass `overrides`.
 */
export const clusterLayer = (
  overrides: ShardingSettings = {},
  // Tests give their runner tables of its own (`<prefix>_messages`…), so
  // test files that run a SQL runner at once on one database never hold
  // each other's shards. The server keeps `cluster`.
  tablePrefix?: string
) =>
  ClusterWorkflowEngine.layer.pipe(
    Layer.provideMerge(runnerLive(overrides, tablePrefix)),
    // Message keys longer than the column are stored as their SHA-256.
    Layer.provide(Digest.layerWebCrypto)
  );

export const ClusterLive = clusterLayer();
