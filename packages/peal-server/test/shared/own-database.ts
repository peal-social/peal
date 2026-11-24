import { PgClient } from "@effect/sql-pg";
import {
  Config,
  ConfigProvider,
  Effect,
  Layer,
  Option,
  Redacted,
} from "effect";
import { SqlClient } from "effect/sql";

import { databaseNameOf } from "#shared/infrastructure/database-name.ts";

/**
 * Settings that name a database of the suite's own beside the one
 * DATABASE_URL names (`<name>_<suffix>`, made when missing, and kept for
 * the next run), for a suite that runs what reaches every row of its
 * database, as the server's daily jobs do: on the database the other
 * suites share, it would change or delete their rows while they run.
 * Provide them above `DatabaseLive` and the migrations.
 */
export const ownDatabase = (suffix: string) =>
  Layer.unwrap(
    Effect.gen(function* namingOwnDatabase() {
      const shared = yield* Config.String("DATABASE_URL");

      const name = yield* Option.match(databaseNameOf(shared), {
        onNone: () => Effect.die(new Error("DATABASE_URL names no database")),
        onSome: (database) => Effect.succeed(`${database}_${suffix}`),
      });

      const exists = SqlClient.SqlClient.use((sql) =>
        sql<{
          readonly found: number;
        }>`SELECT count(*)::int AS found FROM pg_database WHERE datname = ${name}`.pipe(
          Effect.map(([row]) => (row?.found ?? 0) > 0)
        )
      );

      // Two runs may make it at once: the one that loses finds it made.
      yield* Effect.gen(function* made() {
        if (yield* exists) {
          return;
        }

        yield* SqlClient.SqlClient.use(
          (sql) => sql`CREATE DATABASE ${sql(name)}`
        ).pipe(
          Effect.catch((error) =>
            exists.pipe(
              Effect.flatMap((found) =>
                found ? Effect.void : Effect.fail(error)
              )
            )
          )
        );
      }).pipe(
        Effect.provide(PgClient.layer({ url: Redacted.make(shared) })),
        Effect.orDie
      );

      const own = new URL(shared);

      own.pathname = `/${encodeURIComponent(name)}`;

      return ConfigProvider.layerAdd(
        ConfigProvider.fromUnknown({ DATABASE_URL: own.href }),
        { asPrimary: true }
      );
    }).pipe(Effect.orDie)
  );
