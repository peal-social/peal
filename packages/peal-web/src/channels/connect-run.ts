import { Option, Schema } from "effect";
import {
  ChannelConnectionSchema,
  ConnectFailureReasonSchema,
  PlatformSchema,
} from "peal-contract";
import type { ChannelConnection, Platform } from "peal-contract";

import type { ChannelErrorKey } from "#channels/channels-api.ts";

// A run of the home page's setup card: the platforms the member ticked,
// signed in to one after the other, the tab going from each platform's
// callback page to the next one's sign-in. The tab keeps it between those
// pages, as it keeps the connection under way (`pending-connection.ts`);
// the server knows nothing of it, and checks each connection on its own.
const storageKey = "peal.channels.connect-run";

// What the home page listens to, to show the run as it changes.
const changedEvent = "peal:connect-run";

/** One platform's sign-in, with what it starts from. */
const StepSchema = Schema.Struct({
  connection: Schema.optionalKey(ChannelConnectionSchema),
  handle: Schema.optionalKey(Schema.String),
  instance: Schema.optionalKey(Schema.String),
  platform: PlatformSchema,
});

export type RunStep = typeof StepSchema.Type;

/** The refusals a sign-in of the run can meet, kept to be shown on Home. */
const RunErrorSchema = Schema.Union([
  ConnectFailureReasonSchema,
  Schema.Literals([
    "forbidden",
    "planLimit",
    "tooManyTries",
    "unknown",
    "unreachable",
    "xPaymentFailed",
    "xPaymentMethod",
    "xPerAccountPricing",
  ]),
]);

export type RunError = typeof RunErrorSchema.Type;

const isRunError = Schema.is(RunErrorSchema);

/** A refusal as the run keeps it: any it does not expect is unknown. */
export const runErrorOf = (error: ChannelErrorKey): RunError =>
  isRunError(error) ? error : "unknown";

const OutcomeSchema = Schema.Union([
  // The accounts connected, by handle: one, or those chosen among several.
  Schema.TaggedStruct("connected", { handles: Schema.Array(Schema.String) }),
  Schema.TaggedStruct("failed", { error: RunErrorSchema }),
  // The member left a choice of accounts without choosing.
  Schema.TaggedStruct("skipped", {}),
]);

export type RunOutcome = typeof OutcomeSchema.Type;

const RunSchema = Schema.Struct({
  // What each step came to, in order: the step after the last is next.
  outcomes: Schema.Array(OutcomeSchema),
  steps: Schema.Array(StepSchema),
  workspaceId: Schema.String,
});

export type ConnectRun = typeof RunSchema.Type;

const decodeRun = Schema.decodeUnknownOption(Schema.fromJsonString(RunSchema));

const storage = (): Option.Option<Storage> => {
  try {
    return Option.some(globalThis.sessionStorage);
  } catch {
    // Storage the browser refuses (some private modes) keeps no run: each
    // platform then comes back to Home, where the member continues.
    return Option.none();
  }
};

const announce = (): void => {
  globalThis.dispatchEvent(new Event(changedEvent));
};

/** A new run, nothing done yet. */
export const runOf = (
  workspaceId: string,
  steps: readonly RunStep[]
): ConnectRun => ({ outcomes: [], steps, workspaceId });

/** The step that comes next, or none once every step came to something. */
export const nextStep = (run: ConnectRun): RunStep | null =>
  run.steps[run.outcomes.length] ?? null;

/** The step after the next, which a callback page names before it leaves. */
export const stepAfterNext = (run: ConnectRun): RunStep | null =>
  run.steps[run.outcomes.length + 1] ?? null;

export const isDone = (run: ConnectRun): boolean => nextStep(run) === null;

/**
 * The run once `platform`'s sign-in came to `outcome`: unchanged when the
 * next step is another platform's, as a tab that went back and forth may
 * finish a sign-in the run has already moved past.
 */
export const recorded = (
  run: ConnectRun,
  platform: Platform,
  outcome: RunOutcome
): ConnectRun =>
  nextStep(run)?.platform === platform
    ? { ...run, outcomes: [...run.outcomes, outcome] }
    : run;

/** The accounts the run connected, across its steps. */
export const connectedCount = (run: ConnectRun): number =>
  run.outcomes.flatMap((outcome) =>
    outcome._tag === "connected" ? outcome.handles : []
  ).length;

/** The steps the run tried and that failed. */
export const failedCount = (run: ConnectRun): number =>
  run.outcomes.filter(({ _tag }) => _tag === "failed").length;

/** What starting a step's sign-in sends. */
export const startOf = (
  step: RunStep
): {
  readonly connection?: ChannelConnection;
  readonly handle?: string;
  readonly instance?: string;
} => {
  const { platform: _platform, ...payload } = step;

  return payload;
};

/** The run this tab keeps, or none. */
export const currentRun = (): ConnectRun | null =>
  storage().pipe(
    Option.flatMap((tab) => Option.fromNullOr(tab.getItem(storageKey))),
    Option.flatMap(decodeRun),
    Option.getOrNull
  );

/**
 * The run this tab keeps when `platform`'s sign-in in `workspaceId` is its
 * next step, so the callback page carries it on; none otherwise.
 */
export const runAt = (
  workspaceId: string,
  platform: Platform
): ConnectRun | null => {
  const run = currentRun();

  return run !== null &&
    run.workspaceId === workspaceId &&
    nextStep(run)?.platform === platform
    ? run
    : null;
};

export const saveRun = (run: ConnectRun): void => {
  for (const tab of Option.toArray(storage())) {
    tab.setItem(storageKey, JSON.stringify(run));
  }

  announce();
};

/** Records what `platform`'s sign-in came to, and answers the run then. */
export const recordStep = (
  run: ConnectRun,
  platform: Platform,
  outcome: RunOutcome
): ConnectRun => {
  const next = recorded(run, platform, outcome);

  saveRun(next);

  return next;
};

export const forgetRun = (): void => {
  for (const tab of Option.toArray(storage())) {
    tab.removeItem(storageKey);
  }

  announce();
};

/** Listens for the run changing, for `useSyncExternalStore`. */
export const subscribeToRun = (listener: () => void): (() => void) => {
  globalThis.addEventListener(changedEvent, listener);

  return () => {
    globalThis.removeEventListener(changedEvent, listener);
  };
};

/** The run as JSON, a value `useSyncExternalStore` can compare. */
export const runSnapshot = (): string | null =>
  storage().pipe(
    Option.flatMap((tab) => Option.fromNullOr(tab.getItem(storageKey))),
    Option.getOrNull
  );

/** The run a snapshot holds. */
export const runOfSnapshot = (snapshot: string | null): ConnectRun | null =>
  snapshot === null ? null : decodeRun(snapshot).pipe(Option.getOrNull);
