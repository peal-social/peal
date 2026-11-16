// The release history, read from Git: each app tag (versions.ts) is a
// release, holding the commits on main's first-parent line since the tag
// before it, of which only the squash-merged pull requests make entries
// (entries.ts), but those labelled `no-changelog` when the caller names
// them. The first release, with no tag before it, lists none: it has the
// summary written by hand in first-release.md. Git is read only here,
// through its command line, and never over the network: a clone without
// tags, a shallow one or no repository at all gives an empty history,
// which the page says.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { entriesOf } from "./entries.ts";
import type { Entry } from "./entries.ts";
import {
  compareVersions,
  nextVersion,
  tagOf,
  versionOfTag,
} from "./versions.ts";
import type { Version } from "./versions.ts";

export interface Release {
  /** `v2026.11.16`. */
  readonly tag: string;
  /** The day it shipped, `YYYY-MM-DD`. */
  readonly date: string;
  /** The commit it deployed, in full. */
  readonly commit: string;
  readonly entries: readonly Entry[];
  /** The first release's summary, in Markdown, in place of entries. */
  readonly summary?: string;
}

export interface History {
  /** The GitHub repository the entries link to, `owner/name`. */
  readonly repository: string;
  /** Newest first. */
  readonly releases: readonly Release[];
}

export const repository = "peal-social/peal";

export const emptyHistory: History = { releases: [], repository };

/** What a history leaves out: the pull requests labelled `no-changelog`. */
export interface Options {
  readonly excluded: ReadonlySet<number>;
}

const noOptions: Options = { excluded: new Set() };

/** The first release's summary, as written in first-release.md. */
export const firstReleaseSummary = (): string =>
  readFileSync(new URL("first-release.md", import.meta.url), "utf-8").trim();

const git = (folder: string, args: readonly string[]): string =>
  execFileSync("git", ["-C", folder, ...args], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

interface Tagged {
  readonly tag: string;
  readonly version: Version;
  readonly commit: string;
}

/** The app's tags, older first, with the commit each points at. */
const appTags = (folder: string): readonly Tagged[] =>
  git(folder, [
    "for-each-ref",
    "refs/tags",
    "--format=%(refname:short)%00%(objectname)%00%(*objectname)",
  ])
    .split("\n")
    .flatMap((line) => {
      const [tag = "", object = "", peeled = ""] = line.split("\0");
      const version = versionOfTag(tag);

      // An annotated tag points at itself; its peeled object is the commit.
      return version === undefined
        ? []
        : [{ commit: peeled === "" ? object : peeled, tag, version }];
    })
    .toSorted((left, right) => compareVersions(left.version, right.version));

/** The subjects of main's commits after `from` up to `to`, newest first. */
const subjects = (
  folder: string,
  from: string,
  to: string
): readonly string[] =>
  git(folder, ["log", "--first-parent", "--format=%s", `${from}..${to}`])
    .split("\n")
    .filter((line) => line !== "");

const releaseOf = (
  folder: string,
  tagged: Tagged,
  before: Tagged | undefined,
  options: Options
): Release => {
  const release = {
    commit: tagged.commit,
    date: tagged.version.date,
    tag: tagged.tag,
  };

  if (before === undefined) {
    return { ...release, entries: [], summary: firstReleaseSummary() };
  }

  return {
    ...release,
    entries: entriesOf(subjects(folder, before.commit, tagged.commit)).filter(
      (entry) => !options.excluded.has(entry.pull)
    ),
  };
};

const historyOf = (
  folder: string,
  tags: readonly Tagged[],
  options: Options
): History => ({
  releases: tags
    .map((tagged, index) => releaseOf(folder, tagged, tags[index - 1], options))
    .toReversed(),
  repository,
});

/** The full hash of a commit the repository holds, or undefined. */
export const commitOf = (folder: string, ref: string): string | undefined => {
  try {
    return git(folder, [
      "rev-parse",
      "--verify",
      "--quiet",
      `${ref}^{commit}`,
    ]).trim();
  } catch {
    return undefined;
  }
};

/** The releases the repository's tags name, or none without Git or tags. */
export const historyFromGit = (
  folder: string,
  options: Options = noOptions
): History => {
  try {
    return historyOf(folder, appTags(folder), options);
  } catch {
    return emptyHistory;
  }
};

export interface Upcoming {
  readonly history: History;
  /** The release of the commit: its own tag's, or the one it is to take. */
  readonly release: Release;
  /** Whether a tag names it already, as when the commit is released again. */
  readonly tagged: boolean;
}

/**
 * The history once `commit` ships on `date`. A commit an app tag names
 * keeps that tag (its earliest), and the history stays as it is; any other
 * takes the next version of the day, after every tag there is, and holds
 * the commits since the newest release. A commit older than that release,
 * such as a roll-back to one never released, holds none.
 */
export const upcoming = (
  folder: string,
  commit: string,
  date: string,
  options: Options = noOptions
): Upcoming => {
  const tags = appTags(folder);
  const own = tags.find((tagged) => tagged.commit === commit);

  if (own !== undefined) {
    const history = historyOf(folder, tags, options);
    const release = history.releases.find((found) => found.tag === own.tag);

    if (release !== undefined) {
      return { history, release, tagged: true };
    }
  }

  const version = nextVersion(
    tags.map((tagged) => tagged.version),
    date
  );

  const newest = tags.at(-1);

  // A clock behind the newest release would name one that sorts before it.
  if (newest !== undefined && compareVersions(version, newest.version) <= 0) {
    throw new Error(
      `${date} is before the newest release, ${newest.tag}: check the clock`
    );
  }

  const pending: Tagged = { commit, tag: tagOf(version), version };
  const history = historyOf(folder, [...tags, pending], options);

  return {
    history,
    release: releaseOf(folder, pending, newest, options),
    tagged: false,
  };
};
