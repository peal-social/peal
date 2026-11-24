import { Schema } from "effect";

import type { PathMove } from "./api-changes.ts";

/**
 * A breaking change decided on, in released/accepted-changes.json: one the
 * check of the document prints (no `kind`), or one the document cannot
 * show, which is kept as written until the next release: `behaviour`, what
 * an endpoint does or refuses now, and `sdk`, a type the SDKs' generator
 * renamed or narrowed.
 */
const DecidedChangeSchema = Schema.Struct({
  // The change, as the check prints it, or in words for a `kind`.
  change: Schema.String,
  kind: Schema.optionalKey(Schema.Literals(["behaviour", "sdk"])),
  // Why it was made, and what clients do about it.
  reason: Schema.NonEmptyString,
});

/**
 * A move of every operation under a path (`from`) to another (`to`),
 * without the path parameter it drops (`dropping`): the check compares
 * each operation at its new place, and finds every other change there.
 */
const MoveSchema = Schema.Struct({
  change: Schema.String,
  dropping: Schema.optionalKey(Schema.NonEmptyString),
  from: Schema.String.check(Schema.isPattern(/^\//u)),
  kind: Schema.Literal("move"),
  reason: Schema.NonEmptyString,
  to: Schema.String.check(Schema.isPattern(/^\//u)),
});

export const AcceptedChangeSchema = Schema.Union([
  DecidedChangeSchema,
  MoveSchema,
]);

export type AcceptedChange = typeof AcceptedChangeSchema.Type;

type AcceptedMove = typeof MoveSchema.Type;

const isMove = (accepted: AcceptedChange): accepted is AcceptedMove =>
  accepted.kind === "move";

/** The moves decided on, as the check of the document takes them. */
export const movesOf = (
  accepted: readonly AcceptedChange[]
): readonly AcceptedMove[] => accepted.filter(isMove);

/**
 * The document's breaking changes no one accepted, the accepted document
 * changes that no longer happen, and the accepted moves that moved
 * nothing (`moved` lists those that took an operation): each fails the
 * check.
 */
export const checkAccepted = (
  breaking: readonly string[],
  accepted: readonly AcceptedChange[],
  moved: readonly PathMove[] = []
) => {
  const ofDocument = accepted.filter(({ kind }) => kind === undefined);

  return {
    stale: [
      ...ofDocument.filter(({ change }) => !breaking.includes(change)),
      ...movesOf(accepted).filter((move) => !moved.includes(move)),
    ],
    unaccepted: breaking.filter(
      (line) => !ofDocument.some(({ change }) => change === line)
    ),
  };
};

/** The accepted changes as the changelog serves them: what, and why. */
export const breakingOf = (accepted: readonly AcceptedChange[]) =>
  accepted.map(({ change, reason }) => ({ change, reason }));
