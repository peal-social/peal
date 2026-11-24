import { PgClient } from "@effect/sql-pg";
import {
  Config,
  ConfigProvider,
  Effect,
  Layer,
  Option,
  Redacted,
  Result,
} from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql";

import { databaseNameOf } from "#shared/infrastructure/database-name.ts";

// Postgres keeps a name to 63 bytes and cuts a longer one, so a check by
// the whole name would never find the database it made.
const longestName = 63;

const bytesOf = (name: string) => new TextEncoder().encode(name).byteLength;

/**
 * The name of the suite's own database beside the one `shared` names
 * (`<name>_<suffix>`), or why there is none: the URL names no database,
 * or the name would pass Postgres's 63 bytes.
 */
export const ownDatabaseName = (
  shared: string,
  suffix: string
): Result.Result<string, string> =>
  Option.match(databaseNameOf(shared), {
    onNone: () => Result.fail("DATABASE_URL names no database"),
    onSome: (database) => {
      const name = `${database}_${suffix}`;

      return bytesOf(name) > longestName
        ? Result.fail(
            `The database ${name} would pass Postgres's ${String(longestName)} bytes: give DATABASE_URL a database whose name is at most ${String(longestName - suffix.length - 1)} bytes long`
          )
        : Result.succeed(name);
    },
  });

/** What a failure to make the database `name` is said as. */
export const creationFailure = (error: SqlError.SqlError, name: string) =>
  error.reason._tag === "AuthorizationError"
    ? new Error(
        `This suite runs the server's daily jobs on a database of its own, ${name}, so they never reach the rows the other suites keep: the role DATABASE_URL names needs CREATEDB to make it (ALTER ROLE … CREATEDB), or make it once by hand`,
        { cause: error }
      )
    : error;

/**
 * Settings that name a database of the suite's own beside the one
 * DATABASE_URL names (`ownDatabaseName`, made when missing, and kept for
 * the next run), for a suite that runs what reaches every row of its
 * database, as the server's daily jobs do: on the database the other
 * suites share, it would change or delete their rows while they run.
 * Provide them above `DatabaseLive` and the migrations.
 */
export const ownDatabase = (suffix: string) =>
  Layer.unwrap(
    Effect.gen(function* namingOwnDatabase() {
      const shared = yield* Config.String("DATABASE_URL");

      const name = yield* Result.match(ownDatabaseName(shared, suffix), {
        onFailure: (why) => Effect.die(new Error(why)),
        onSuccess: Effect.succeed,
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
                found ? Effect.void : Effect.die(creationFailure(error, name))
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
