// Vitest's sequencer for the server's tests: `--shard` splits the files
// by their measured durations (`./shards.ts`) rather than by count, and
// `--sequence.shuffle.files`, which a sequencer of its own replaces in
// Vitest, still shuffles them.
import type { TestSequencer, TestSpecification, Vitest } from "vitest/node";

import { readDurations, relativeFile, shardsOf, weightsOf } from "./shards.ts";

// The same order for the same seed (`--sequence.seed`).
const shuffled = <A>(items: readonly A[], seed: number) => {
  let state = seed;

  const random = () => {
    const x = Math.sin(state) * 10_000;

    state += 1;

    return x - Math.floor(x);
  };

  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const kept = result[index];
    const moved = result[other];

    if (kept !== undefined && moved !== undefined) {
      result[index] = moved;
      result[other] = kept;
    }
  }

  return result;
};

export class DurationSequencer implements TestSequencer {
  private readonly durations = readDurations();
  private readonly ctx: Vitest;

  constructor(ctx: Vitest) {
    this.ctx = ctx;
  }

  private fileOf(spec: TestSpecification) {
    return relativeFile(this.ctx.config.root, spec.moduleId);
  }

  // This shard's files, of the split every shard computes alike.
  shard(files: TestSpecification[]) {
    const { shard } = this.ctx.config;

    if (shard === undefined) {
      return files;
    }

    const shards = shardsOf(
      files.map((spec) => this.fileOf(spec)),
      this.durations,
      shard.count
    );

    const own = new Set(shards[shard.index - 1]);

    return files.filter((spec) => own.has(this.fileOf(spec)));
  }

  // Shuffled when asked; otherwise the longest files first, so none
  // starts last (a shard on CI has no earlier results to go by).
  sort(files: TestSpecification[]) {
    const { cliOptions, sequence } = this.ctx.config;
    const shuffle = cliOptions.sequence?.shuffle;

    if (
      shuffle === true ||
      (shuffle !== undefined && shuffle !== false && shuffle.files === true)
    ) {
      this.ctx.logger.log(
        `Test files shuffled with seed ${String(sequence.seed)}`
      );

      return shuffled(files, sequence.seed);
    }

    const weights = weightsOf(
      files.map((spec) => this.fileOf(spec)),
      this.durations
    );

    return files.toSorted(
      (left, right) =>
        (weights.get(this.fileOf(right)) ?? 0) -
        (weights.get(this.fileOf(left)) ?? 0)
    );
  }
}
