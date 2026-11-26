import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Config, Context, Layer, Schema } from "effect";

/**
 * DATABASE_POOL_MAX: the connections the pool opens at most, 20 unless set.
 * The HTTP API, the jobs and the cluster's own reads share them, so a
 * pool too small makes every request wait for one, and the cluster's
 * check of its shards time out under load (a load test, 2026-11-26: at
 * Effect's default of 10). Anything but a whole number from 1 to 1,000
 * stops the server.
 */
export const databasePoolMaxConfig = Config.schema(
  Schema.Int.check(Schema.isBetween({ maximum: 1000, minimum: 1 })),
  "DATABASE_POOL_MAX"
).pipe(Config.withDefault(20));

// The Postgres connection pool, read from DATABASE_URL. It provides both
// PgClient and Effect's generic SqlClient. Connections open on first use, so
// the layer builds while the database is down and queries fail instead.
export const SqlLive = PgClient.layerConfig({
  applicationName: Config.succeed("peal-server"),
  maxConnections: databasePoolMaxConfig,
  url: Config.Redacted("DATABASE_URL"),
});

// The Drizzle database, running its queries through the pool above.
// Repositories build their queries with it from the tables that each context
// declares in src/<context>/infrastructure/schema.ts.
export class Drizzle extends Context.Service<
  Drizzle,
  PgDrizzle.EffectPgDatabase
>()("peal-server/shared/infrastructure/Drizzle") {
  static readonly layer = Layer.effect(Drizzle, PgDrizzle.makeWithDefaults());
}

// PgClient, SqlClient and Drizzle, sharing one pool.
export const DatabaseLive = Drizzle.layer.pipe(Layer.provideMerge(SqlLive));
