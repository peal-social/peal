// Measures the server's test files again, for CI's shards: reads the
// durations each shard of a CI run uploaded (its `server-test-durations-*`
// artifacts) and writes them to test/durations.json, which the shards are
// split by. Run it on a recent run of `main`, all shards passed:
//
//   nx run peal-server:test-durations -- <run id>
//
// or on the files a local run wrote (`PEAL_TEST_DURATIONS_OUTPUT`):
//
//   nx run peal-server:test-durations -- --from <folder>
//
// A file the run did not measure keeps its duration, and one that no
// longer exists is dropped.
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { durationsFile, readDurations } from "#test/shards.ts";

const root = path.join(import.meta.dirname, "..");

// Every JSON file under `folder`, as gh lays out an artifact per folder.
const reportsIn = (folder: string): string[] =>
  readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(entry.parentPath, entry.name));

const downloaded = (run: string) => {
  const folder = mkdtempSync(path.join(tmpdir(), "peal-test-durations-"));

  const download = Bun.spawnSync(
    [
      "gh",
      "run",
      "download",
      run,
      "--pattern",
      "server-test-durations-*",
      "--dir",
      folder,
    ],
    { stderr: "inherit", stdout: "inherit" }
  );

  if (download.exitCode !== 0) {
    rmSync(folder, { force: true, recursive: true });
    throw new Error(`gh could not download the durations of run ${run}.`);
  }

  return folder;
};

const [first, second] = Bun.argv.slice(2);

if (first === undefined || (first === "--from" && second === undefined)) {
  throw new Error("Give a CI run's id, or --from and a folder of reports.");
}

const fromRun = first !== "--from";
const folder = fromRun ? downloaded(first) : path.resolve(second ?? "");

try {
  const reports = reportsIn(folder);

  if (reports.length === 0) {
    throw new Error(`No durations found in ${folder}.`);
  }

  const measured = Object.fromEntries(
    reports.flatMap((report) => Object.entries(readDurations(report)))
  );

  const durations = Object.fromEntries(
    Object.entries({ ...readDurations(), ...measured })
      .filter(([file]) => existsSync(path.join(root, file)))
      .toSorted(([left], [right]) => (left < right ? -1 : 1))
  );

  await Bun.write(durationsFile, `${JSON.stringify(durations, null, 2)}\n`);

  console.log(
    `Measured ${String(Object.keys(measured).length)} files from ${String(reports.length)} reports; ${String(Object.keys(durations).length)} in ${path.relative(root, durationsFile)}.`
  );
} finally {
  if (fromRun) {
    rmSync(folder, { force: true, recursive: true });
  }
}
