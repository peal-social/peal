// The release notes and the docs' Changelog, from the conventional-commit
// history (changelog/), for release.yml and for a look before a release.
// Git is read locally, never fetched.
//
//   bun packages/peal-docs/scripts/changelog.ts notes [--repo .] [--commit HEAD] [--date YYYY-MM-DD]
//     What a release of the commit would be named and hold, to read.
//   bun packages/peal-docs/scripts/changelog.ts release --repo <checkout> --commit <sha> [--date …] [--write <file>]
//     The same as JSON for release.yml ({tag, tagged, commit, notes}, or
//     {unknown: true} for a commit the checkout lacks), and with --write the
//     history file the docs read, this release in it.
//   bun packages/peal-docs/scripts/changelog.ts history --repo <checkout> --write <file>
//     The history file with the releases tagged so far alone.
//   --exclude "12 34" leaves those pull requests out (release.yml passes
//   the ones labelled no-changelog).
//   bun packages/peal-docs/scripts/changelog.ts fingerprint
//     A hash of the history the docs would show, for Nx's cache.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { historyFile } from "../changelog/file.ts";
import { commitOf, historyFromGit, upcoming } from "../changelog/history.ts";
import type { History, Options } from "../changelog/history.ts";
import { loadHistory } from "../changelog/load.ts";
import { releaseNotes } from "../changelog/render.ts";
import { isDate, today } from "../changelog/versions.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    commit: { default: "HEAD", type: "string" },
    date: { type: "string" },
    exclude: { default: "", type: "string" },
    repo: { default: ".", type: "string" },
    write: { type: "string" },
  },
});

const fail = (message: string): never => {
  process.stderr.write(`changelog: ${message}\n`);
  process.exit(1);
};

// The pull requests labelled `no-changelog`, by number, separated by
// spaces, commas or lines, as `gh pr list --jq '.[].number'` prints them.
const excludedNumbers = values.exclude
  .split(/[\s,]+/u)
  .filter((part) => part !== "");

if (excludedNumbers.some((part) => !/^[1-9]\d*$/u.test(part))) {
  fail(`--exclude takes pull request numbers, not ${values.exclude}`);
}

const options: Options = { excluded: new Set(excludedNumbers.map(Number)) };

const date = values.date ?? today();

if (!isDate(date)) {
  fail(`--date ${date} is not a day (YYYY-MM-DD)`);
}

const write = (history: History): void => {
  if (values.write !== undefined) {
    writeFileSync(values.write, historyFile(history));
  }
};

/** What release.yml reads: the release's name and notes, or that the commit is unknown. */
type Answer =
  | {
      readonly commit: string;
      readonly notes: string;
      readonly tag: string;
      readonly tagged: boolean;
    }
  | { readonly unknown: true };

const print = (answer: Answer): void => {
  process.stdout.write(`${JSON.stringify(answer)}\n`);
};

const release = (asJson: boolean): void => {
  const commit = commitOf(values.repo, values.commit);

  if (commit === undefined) {
    if (asJson) {
      print({ unknown: true });

      return;
    }

    fail(`${values.repo} holds no commit ${values.commit}`);

    return;
  }

  const next = upcoming(values.repo, commit, date, options);
  const notes = releaseNotes(next.release, next.history.repository);

  if (asJson) {
    write(next.history);
    print({ commit, notes, tag: next.release.tag, tagged: next.tagged });

    return;
  }

  process.stdout.write(
    `${next.release.tag} (${next.tagged ? "tagged already" : "next release"}), ${commit}, ${next.release.entries.length} entries\n\n${notes}`
  );
};

const [command = ""] = positionals;

switch (command) {
  case "notes": {
    release(false);
    break;
  }

  case "release": {
    release(true);
    break;
  }

  case "history": {
    if (values.write === undefined) {
      fail("history needs --write <file>");
    }

    write(historyFromGit(values.repo, options));
    break;
  }

  case "fingerprint": {
    process.stdout.write(
      `${createHash("sha256").update(historyFile(loadHistory())).digest("hex")}\n`
    );
    break;
  }

  default: {
    fail("name a command: notes, release, history or fingerprint");
  }
}
