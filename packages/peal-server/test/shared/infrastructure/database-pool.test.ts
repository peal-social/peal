import { assert, it } from "@effect/vitest";
import { ConfigProvider, Effect, Result } from "effect";

import { databasePoolMaxConfig } from "#shared/infrastructure/database.ts";

// The setting as the server reads it from this value.
const read = (value: string | undefined) =>
  databasePoolMaxConfig.pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: value === undefined ? {} : { DATABASE_POOL_MAX: value },
        })
      )
    ),
    Effect.result
  );

it.effect("opens 20 connections unless DATABASE_POOL_MAX says", () =>
  Effect.gen(function* pool() {
    assert.deepStrictEqual(yield* read(undefined), Result.succeed(20));
    assert.deepStrictEqual(yield* read("40"), Result.succeed(40));
  })
);

it.effect("stops the server for a pool that is no whole number from 1", () =>
  Effect.gen(function* refused() {
    for (const value of ["0", "-3", "2.5", "many", "1001"]) {
      assert.isTrue(Result.isFailure(yield* read(value)), value);
    }
  })
);
