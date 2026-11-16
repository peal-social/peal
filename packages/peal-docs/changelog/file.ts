// The history as a file, `packages/peal-docs/changelog.json` (ignored by
// Git): release.yml writes it into the commit it builds, with the release it
// deploys, since the images build the docs without the repository's Git.
// Its `version` says how it is written; a file of another version, or one
// that cannot be read, is ignored, and the docs read Git instead.
import { existsSync, readFileSync } from "node:fs";

import { Option, Schema } from "effect";

import { sections } from "./entries.ts";
import type { History } from "./history.ts";
import { isDate, versionOfTag } from "./versions.ts";

const EntrySchema = Schema.Struct({
  breaking: Schema.Boolean,
  description: Schema.NonEmptyString,
  pull: Schema.Int.check(Schema.isGreaterThan(0)),
  section: Schema.Literals(sections),
});

const ReleaseSchema = Schema.Struct({
  commit: Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u)),
  date: Schema.String.check(Schema.makeFilter(isDate)),
  entries: Schema.Array(EntrySchema),
  tag: Schema.String.check(
    Schema.makeFilter((tag: string) => versionOfTag(tag) !== undefined)
  ),
});

export const HistoryFileSchema = Schema.Struct({
  releases: Schema.Array(ReleaseSchema),
  repository: Schema.String.check(Schema.isPattern(/^[\w.-]+\/[\w.-]+$/u)),
  version: Schema.Literal(1),
});

export type HistoryFile = typeof HistoryFileSchema.Type;

const decodeFile = Schema.decodeUnknownOption(
  Schema.fromJsonString(HistoryFileSchema)
);

/** The file's text for a history. */
export const historyFile = (history: History): string =>
  `${JSON.stringify({ ...history, version: 1 } satisfies HistoryFile, null, 2)}\n`;

/** The history a file holds, or undefined when there is none to read. */
export const historyFromFile = (path: string): History | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }

  return Option.getOrUndefined(
    decodeFile(readFileSync(path, "utf-8")).pipe(
      Option.map(({ releases, repository }) => ({ releases, repository }))
    )
  );
};
