// CI's shards run every test file once: none left out, none twice,
// measured or new, and about the same time each.
import { globSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readDurations, shardsOf, weightsOf } from "./shards.ts";

const root = path.join(import.meta.dirname, "..");

const testFiles = globSync("test/**/*.test.ts", { cwd: root })
  .map((file) => file.split(path.sep).join("/"))
  .toSorted();

const durations = readDurations();

const counts = [1, 2, 3, 4, 5, 6, 8, 12];

describe("the server's test shards", () => {
  it.each(counts)(
    "hold every test file exactly once, in %i shards",
    (count) => {
      const shards = shardsOf(testFiles, durations, count);

      expect(shards).toHaveLength(count);
      expect(shards.flat().toSorted()).toStrictEqual(testFiles);
    }
  );

  it("give a file never measured to one shard", () => {
    const added = "test/app/never-measured.test.ts";
    const files = [...testFiles, added];

    for (const count of counts) {
      const holding = shardsOf(files, durations, count).filter((shard) =>
        shard.includes(added)
      );

      expect(holding).toHaveLength(1);
    }
  });

  it("split files by their durations, not their count", () => {
    const weights = weightsOf(testFiles, durations);

    const weightOf = (shard: readonly string[]) =>
      shard.reduce((sum, file) => sum + (weights.get(file) ?? 0), 0);

    const total = weightOf(testFiles);
    const heaviest = Math.max(...weights.values());

    for (const count of counts) {
      // The heaviest file first, each to the lightest shard: none ends
      // more than one file past an even share.
      for (const shard of shardsOf(testFiles, durations, count)) {
        expect(weightOf(shard)).toBeLessThanOrEqual(total / count + heaviest);
      }
    }
  });

  it("split the same files the same way, whatever their order", () => {
    expect(shardsOf(testFiles.toReversed(), durations, 4)).toStrictEqual(
      shardsOf(testFiles, durations, 4)
    );
  });
});
