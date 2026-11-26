import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

import { DurationSequencer } from "./test/duration-sequencer.ts";
import { durationsReporter } from "./test/durations-reporter.ts";

// Where a run writes how long each file took (CI's shards upload it).
const durationsOutput = process.env["PEAL_TEST_DURATIONS_OUTPUT"];

export default defineConfig({
  test: {
    // Each test file's app opens a pool of its own: at the server's 20 a
    // run could pass the 100 connections of CI's Postgres (the stack's
    // allows 400), so tests keep 10 unless told otherwise.
    env: { DATABASE_POOL_MAX: process.env["DATABASE_POOL_MAX"] ?? "10" },
    include: ["test/**/*.test.ts"],
    // Files share each worker's modules, so a file does not import the
    // server again (four times faster): no test keeps state in a module,
    // which runs in a shuffled file order (`--sequence.shuffle.files`) check.
    isolate: false,
    reporters:
      durationsOutput === undefined || durationsOutput === ""
        ? configDefaults.reporters
        : [
            ...configDefaults.reporters,
            durationsReporter(
              import.meta.dirname,
              path.resolve(durationsOutput)
            ),
          ],
    // `--shard` splits the files by their measured durations.
    sequence: { sequencer: DurationSequencer },
    // Integration tests wait for emails to reach Mailpit.
    testTimeout: 90_000,
  },
});
