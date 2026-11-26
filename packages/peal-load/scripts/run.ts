// What every script of a load run shares: the database, the ports, and the
// run's own files in `.local/` (Git-ignored): the fake platform's
// certificate, the token key the channels are sealed with, the accounts
// `setup.ts` made, the servers' logs and k6's results.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";

export const packageRoot = path.join(import.meta.dirname, "..");
export const serverRoot = path.join(packageRoot, "..", "peal-server");
export const runDir = path.join(packageRoot, ".local");

mkdirSync(runDir, { recursive: true });

/**
 * The database a run uses, which must be named `…scale`, as
 * `seed-scale.ts` asks: a load run writes tens of thousands of posts and
 * jobs, never into the development database.
 */
export const databaseUrl =
  process.env["DATABASE_URL"] ??
  "postgres://peal:peal@127.0.0.1:15432/peal_loadscale";

if (!new URL(databaseUrl).pathname.slice(1).endsWith("scale")) {
  throw new Error("DATABASE_URL must name a database ending in 'scale'");
}

/** The first server's port; the others follow it. */
export const firstPort = 3100;

/** The fake platform's counters (`scripts/fake-platform.ts`). */
export const fakeStatsUrl = "http://127.0.0.1:4011";

export const configPath = path.join(runDir, "config.json");

/**
 * The run's token keyring, `PEAL_TOKEN_KEYS`: one key made for the run on
 * first use and kept beside it, so the channels `setup.ts` seals decrypt
 * on every server of the run. The seed's channels are sealed under `k1`,
 * which it never holds: their calls fail before reaching any platform.
 */
export const tokenKeys = async (): Promise<string> => {
  const file = path.join(runDir, "token-key");

  if (!existsSync(file)) {
    await Bun.write(file, randomBytes(32).toString("base64"));
  }

  const key = await Bun.file(file).text();

  return `load:${key.trim()}`;
};

export const RunConfigSchema = Schema.Struct({
  base: Schema.String,
  workspaces: Schema.Array(
    Schema.Struct({
      apiKey: Schema.String,
      channelIds: Schema.Array(Schema.String),
      workspaceId: Schema.String,
    })
  ),
});

export type RunConfig = typeof RunConfigSchema.Type;
