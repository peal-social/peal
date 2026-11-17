// How CI splits the server's test files between its shards: by the time
// each file took, measured on CI (`durations.json`), so the shards end
// together. `nx run peal-server:test-durations` measures them again.
import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";

/** Milliseconds a test file took, by its path from the package's root. */
export const DurationsSchema = Schema.Record(Schema.String, Schema.Number);

export type Durations = typeof DurationsSchema.Type;

export const durationsFile = path.join(import.meta.dirname, "durations.json");

export const readDurations = (file = durationsFile): Durations =>
  Schema.decodeUnknownSync(Schema.fromJsonString(DurationsSchema))(
    readFileSync(file, "utf-8")
  );

/** A file's path from the package's root, with forward slashes. */
export const relativeFile = (root: string, file: string) =>
  path.relative(root, file).split(path.sep).join("/");

// What a file never measured weighs: the mean of those measured, so a
// new file counts as a typical one, never as nothing.
const weightOfNew = (files: readonly string[], durations: Durations) => {
  const measured = files.flatMap((file) => {
    const duration = durations[file];

    return duration === undefined ? [] : [duration];
  });

  return measured.length === 0
    ? 1
    : measured.reduce((sum, duration) => sum + duration, 0) / measured.length;
};

/**
 * Each file's weight: its measured duration, or that of a typical file
 * for one never measured.
 */
export const weightsOf = (
  files: readonly string[],
  durations: Durations
): ReadonlyMap<string, number> => {
  const unmeasured = weightOfNew(files, durations);

  return new Map(
    files.map((file) => [file, durations[file] ?? unmeasured] as const)
  );
};

/**
 * Splits `files` into `count` shards of about the same total weight: the
 * heaviest file first, each to the lightest shard so far (ties to the
 * first). Every file lands in exactly one shard, measured or not, and the
 * split depends on the files and the durations alone, so every shard
 * computes the same one.
 */
export const shardsOf = (
  files: readonly string[],
  durations: Durations,
  count: number
): (readonly string[])[] => {
  const weights = weightsOf(files, durations);

  const heaviestFirst = [...new Set(files)].toSorted(
    (left, right) =>
      (weights.get(right) ?? 0) - (weights.get(left) ?? 0) ||
      (left < right ? -1 : 1)
  );

  const shards = Array.from({ length: count }, () => ({
    files: new Array<string>(),
    weight: 0,
  }));

  for (const file of heaviestFirst) {
    let [lightest] = shards;

    for (const shard of shards) {
      if (lightest === undefined || shard.weight < lightest.weight) {
        lightest = shard;
      }
    }

    lightest?.files.push(file);

    if (lightest !== undefined) {
      lightest.weight += weights.get(file) ?? 0;
    }
  }

  return shards.map((shard) => shard.files);
};
