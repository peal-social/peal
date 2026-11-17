// A Vitest reporter that writes how long each test file's tests and hooks
// took to the file it is given: what CI's shards upload, and
// `scripts/test-durations.ts` gathers into `durations.json`. Importing is
// left out: a worker imports the server once, for whichever file it runs
// first, which says nothing of that file.
import { writeFileSync } from "node:fs";

import type { Reporter, TestModule } from "vitest/node";

import { relativeFile } from "./shards.ts";

export const durationsReporter = (root: string, file: string): Reporter => ({
  onTestRunEnd: (modules: readonly TestModule[]) => {
    const durations = Object.fromEntries(
      modules
        .map(
          (module) =>
            [
              relativeFile(root, module.moduleId),
              Math.round(module.diagnostic().duration),
            ] as const
        )
        .toSorted(([left], [right]) => (left < right ? -1 : 1))
    );

    writeFileSync(file, `${JSON.stringify(durations, null, 2)}\n`);
  },
});
