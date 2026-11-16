// The release notes and the Changelog page, from a synthetic repository's
// history: what makes an entry, how releases are named, and what the docs
// show without Git or tags.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { entryOf } from "../changelog/entries.ts";
import { historyFile, historyFromFile } from "../changelog/file.ts";
import {
  emptyHistory,
  historyFromGit,
  repository,
  upcoming,
} from "../changelog/history.ts";
import {
  changelogPage,
  escapeMarkdown,
  releaseNotes,
} from "../changelog/render.ts";
import {
  compareVersions,
  nextVersion,
  tagOf,
  versionOfTag,
} from "../changelog/versions.ts";

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { force: true, recursive: true });
  }
});

const scratch = (): string => {
  const folder = mkdtempSync(path.join(tmpdir(), "peal-changelog-"));
  folders.push(folder);

  return folder;
};

const git = (folder: string, ...args: string[]): string =>
  execFileSync(
    "git",
    [
      "-C",
      folder,
      "-c",
      "user.name=Synthetic",
      "-c",
      "user.email=synthetic@example.test",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "tag.gpgsign=false",
      ...args,
    ],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  ).trim();

const headOf = (folder: string): string => git(folder, "rev-parse", "HEAD");

/** A repository with one empty commit per subject, older first. */
const repositoryOf = (subjects: readonly string[]): string => {
  const folder = scratch();
  git(folder, "init", "--quiet", "--initial-branch=main");

  for (const subject of subjects) {
    git(folder, "commit", "--quiet", "--allow-empty", "--message", subject);
  }

  return folder;
};

describe("entries", () => {
  it("takes features, fixes, performance and security, with their pull request", () => {
    expect(entryOf("feat(ads): Meta ads corrections (#127)")).toEqual({
      breaking: false,
      description: "Meta ads corrections",
      pull: 127,
      section: "features",
    });
    expect(entryOf("fix: the rate limit window (#125)")?.section).toBe("fixes");
    expect(entryOf("perf(server): fewer queries (#3)")?.section).toBe(
      "performance"
    );
    expect(entryOf("security: rotate the keys (#4)")?.section).toBe("security");
    expect(entryOf("fix(security): check the origin (#5)")?.section).toBe(
      "security"
    );
    expect(
      entryOf("chore(deps,security): bump a vulnerable package (#6)")?.section
    ).toBe("security");
    expect(entryOf("feat(sdk)!: rename a method (#7)")?.breaking).toBe(true);
  });

  it("leaves out the other types, and commits without a pull request", () => {
    for (const subject of [
      "chore: bump the dependencies (#1)",
      "test(publishing): wait for the first article (#129)",
      "ci: cache the browsers (#2)",
      "docs: the quickstart (#3)",
      "build: pin Bun (#4)",
      "style: format (#5)",
      "refactor: one class per file (#6)",
      "feat: a commit pushed without a pull request",
      "Merge branch 'feat/cli' into integrate/wave-e",
      "Production's apps, the legal pages filled in (#65)",
    ]) {
      expect(entryOf(subject)).toBeUndefined();
    }
  });
});

describe("versions", () => {
  it("names a day's releases vYYYY.MM.DD, then .2, .3", () => {
    expect(tagOf({ date: "2026-11-16", sequence: 1 })).toBe("v2026.11.16");
    expect(tagOf({ date: "2026-01-05", sequence: 2 })).toBe("v2026.01.05.2");
    expect(versionOfTag("v2026.01.05.2")).toEqual({
      date: "2026-01-05",
      sequence: 2,
    });
    expect(nextVersion([], "2026-11-16")).toEqual({
      date: "2026-11-16",
      sequence: 1,
    });
    expect(
      nextVersion(
        [
          { date: "2026-11-15", sequence: 1 },
          { date: "2026-11-16", sequence: 1 },
          { date: "2026-11-16", sequence: 2 },
        ],
        "2026-11-16"
      )
    ).toEqual({ date: "2026-11-16", sequence: 3 });
  });

  it("sorts a day's second release after its first, and the tenth after the ninth", () => {
    const tags = [
      "v2026.11.16.10",
      "v2026.11.17",
      "v2026.11.16",
      "v2026.11.16.9",
    ];

    const sorted = tags
      .flatMap((tag) => {
        const version = versionOfTag(tag);

        return version === undefined ? [] : [version];
      })
      .toSorted(compareVersions)
      .map(tagOf);

    expect(sorted).toEqual([
      "v2026.11.16",
      "v2026.11.16.9",
      "v2026.11.16.10",
      "v2026.11.17",
    ]);
  });

  it("never takes an SDK's tag, or a day that is not one", () => {
    for (const tag of [
      "sdk-node-v0.3.0",
      "packages/peal-sdk/go/v0.3.0",
      "v0.3.0",
      "v2026.13.01",
      "v2026.02.30",
      "v2026.11.16.1",
      "v2026.11.16-2",
      "2026.11.16",
    ]) {
      expect(versionOfTag(tag)).toBeUndefined();
    }
  });
});

describe("markdown", () => {
  it("escapes what MDX would read as markup, and keeps code spans", () => {
    expect(escapeMarkdown("PEAL_INBOX_MESSAGES on <Card> {x}")).toBe(
      "PEAL\\_INBOX\\_MESSAGES on \\<Card\\> \\{x\\}"
    );
    expect(escapeMarkdown("set `PEAL_ADS` to {read}")).toBe(
      "set `PEAL_ADS` to \\{read\\}"
    );
  });
});

describe("history", () => {
  const subjects = [
    "chore: set up the workspace",
    "feat: the first pull request (#1)",
    "fix(web): a fix (#2)",
    "chore: dependencies (#3)",
    "feat(sdk)!: a breaking one (#4)",
  ];

  it("makes the first release of the whole history, its pull requests alone", () => {
    const folder = repositoryOf(subjects);
    const next = upcoming(folder, headOf(folder), "2026-11-16");

    expect(next.tagged).toBe(false);
    expect(next.release.tag).toBe("v2026.11.16");
    expect(next.release.entries.map((entry) => entry.pull)).toEqual([4, 2, 1]);
    expect(releaseNotes(next.release, repository)).toBe(
      [
        "## Features",
        "",
        "- Breaking change: A breaking one ([#4](https://github.com/peal-social/peal/pull/4))",
        "- The first pull request ([#1](https://github.com/peal-social/peal/pull/1))",
        "",
        "## Fixes",
        "",
        "- A fix ([#2](https://github.com/peal-social/peal/pull/2))",
        "",
      ].join("\n")
    );
  });

  it("starts the next release after the last tag, a day's second one with .2", () => {
    const folder = repositoryOf(subjects);
    git(folder, "tag", "v2026.11.16", "HEAD~2");
    git(folder, "tag", "sdk-node-v0.4.0", "HEAD~1");

    const next = upcoming(folder, headOf(folder), "2026-11-16");

    expect(next.release.tag).toBe("v2026.11.16.2");
    expect(next.release.entries.map((entry) => entry.pull)).toEqual([4]);
    expect(next.history.releases.map((release) => release.tag)).toEqual([
      "v2026.11.16.2",
      "v2026.11.16",
    ]);
  });

  it("keeps the tag of a commit released already, whichever the day", () => {
    const folder = repositoryOf(subjects);
    git(folder, "tag", "--annotate", "--message", "Synthetic", "v2026.11.16");

    const next = upcoming(folder, headOf(folder), "2026-11-20");

    expect(next.tagged).toBe(true);
    expect(next.release.tag).toBe("v2026.11.16");
    expect(next.history.releases).toHaveLength(1);
  });

  it("refuses a day before the newest release", () => {
    const folder = repositoryOf(subjects);
    git(folder, "tag", "v2026.11.16", "HEAD~1");

    expect(() =>
      upcoming(folder, git(folder, "rev-parse", "HEAD"), "2026-11-15")
    ).toThrow(/before the newest release, v2026.11.16/u);
  });

  it("is empty without Git's tags or without a repository", () => {
    expect(historyFromGit(repositoryOf(subjects))).toEqual(emptyHistory);
    expect(historyFromGit(scratch())).toEqual(emptyHistory);
  });

  it("reads back the file it writes, and ignores one it cannot read", () => {
    const folder = repositoryOf(subjects);
    git(folder, "tag", "v2026.11.16", "HEAD~2");

    const { history } = upcoming(
      folder,
      git(folder, "rev-parse", "HEAD"),
      "2026-11-17"
    );

    const file = path.join(scratch(), "changelog.json");
    writeFileSync(file, historyFile(history));

    expect(historyFromFile(file)).toEqual(history);

    writeFileSync(file, JSON.stringify({ ...history, version: 2 }));
    expect(historyFromFile(file)).toBeUndefined();
    expect(historyFromFile(path.join(scratch(), "none.json"))).toBeUndefined();
  });
});

describe("page", () => {
  const history = {
    releases: [
      {
        commit: "0".repeat(40),
        date: "2026-11-17",
        entries: [],
        tag: "v2026.11.17",
      },
      {
        commit: "1".repeat(40),
        date: "2026-11-16",
        entries: [
          {
            breaking: false,
            description: "discord as a destination",
            pull: 120,
            section: "features" as const,
          },
        ],
        tag: "v2026.11.16",
      },
    ],
    repository,
  };

  it("shows each release with its day and sections, under pinned anchors", () => {
    expect(changelogPage(history, "en")).toBe(
      [
        "## v2026.11.17 [#v2026-11-17]",
        "Released on 17 November 2026.",
        "Maintenance only: nothing in this release changes how Peal works.",
        "## v2026.11.16 [#v2026-11-16]",
        "Released on 16 November 2026.",
        "### Features [#v2026-11-16-features]",
        "- Discord as a destination ([#120](https://github.com/peal-social/peal/pull/120))",
      ].join("\n\n")
    );
  });

  it("has French headings and days, and the entries in English", () => {
    const page = changelogPage(history, "fr");

    expect(page).toContain("## v2026.11.16 [#v2026-11-16]");
    expect(page).toContain("Publiée le 16 novembre 2026.");
    expect(page).toContain("### Nouveautés [#v2026-11-16-features]");
    expect(page).toContain("- Discord as a destination ([#120]");
  });

  it("says when nothing has been released", () => {
    expect(changelogPage(emptyHistory, "en")).toBe(
      "Nothing has been released yet."
    );
    expect(changelogPage(emptyHistory, "fr")).toBe(
      "Aucune version n’a encore été publiée."
    );
  });
});
