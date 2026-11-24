import { Result } from "effect";
import { SqlError } from "effect/sql";
import { describe, expect, it } from "vitest";

import { creationFailure, ownDatabaseName } from "#test/shared/own-database.ts";

const at = (name: string) =>
  `postgres://peal:synthetic@127.0.0.1:15432/${encodeURIComponent(name)}`;

describe("a suite's own database", () => {
  it("is named after the one DATABASE_URL names", () => {
    expect(ownDatabaseName(at("peal"), "snapshot")).toStrictEqual(
      Result.succeed("peal_snapshot")
    );
  });

  it("is refused a name past Postgres's 63 bytes, which it would cut", () => {
    // 54 bytes and `_snapshot`: 63.
    const longest = "a".repeat(54);

    expect(ownDatabaseName(at(longest), "snapshot")).toStrictEqual(
      Result.succeed(`${longest}_snapshot`)
    );
    expect(
      Result.isFailure(ownDatabaseName(at(`${longest}a`), "snapshot"))
    ).toBeTruthy();
    // Bytes, not characters: é is two.
    expect(
      Result.isFailure(ownDatabaseName(at(`${"a".repeat(53)}é`), "snapshot"))
    ).toBeTruthy();
  });

  it("is refused when DATABASE_URL names no database", () => {
    expect(
      Result.isFailure(
        ownDatabaseName("postgres://peal@127.0.0.1:15432", "snapshot")
      )
    ).toBeTruthy();
  });

  it("says what the role needs when Postgres refuses to make it", () => {
    const refused = new SqlError.SqlError({
      reason: new SqlError.AuthorizationError({
        cause: new Error("permission denied to create database"),
      }),
    });

    const failure = creationFailure(refused, "peal_snapshot");

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toContain("CREATEDB");
    expect(failure.message).toContain("peal_snapshot");

    const other = new SqlError.SqlError({
      reason: new SqlError.ConnectionError({ cause: new Error("down") }),
    });

    expect(creationFailure(other, "peal_snapshot")).toBe(other);
  });
});
