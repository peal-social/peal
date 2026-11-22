import { Option, Schema } from "effect";
import {
  ChannelConnectionSchema,
  ConnectFailureReasonSchema,
  PlatformSchema,
} from "peal-contract";
import type { ChannelConnection, Platform } from "peal-contract";

import type { ChannelErrorKey } from "#channels/channels-api.ts";

// A run of a new workspace's setup step: the platforms the member ticked,
// signed in to one after the other, a tab of its own going from each
// platform's callback page to the next one's sign-in while the step stays
// open in the first tab and follows it. The browser keeps the run where
// every tab reads it (`localStorage`), so the step sees each outcome as it
// lands, and a platform's page that strands its tab strands no run; the
// server knows nothing of it, and checks each connection on its own.
const storageKey = "peal.channels.connect-run";

// What the setup step listens to, to show the run as it changes.
const changedEvent = "peal:connect-run";

/** One platform's sign-in, with what it starts from. */
const StepSchema = Schema.Struct({
  connection: Schema.optionalKey(ChannelConnectionSchema),
  handle: Schema.optionalKey(Schema.String),
  instance: Schema.optionalKey(Schema.String),
  platform: PlatformSchema,
});

export type RunStep = typeof StepSchema.Type;

/** The refusals a sign-in of the run can meet, kept to be shown on the setup step. */
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
    // A closing tab (one refused `close()`) may answer none.
    return Option.fromNullOr(globalThis.localStorage);
  } catch {
    // Storage the browser refuses (some private modes) keeps no run: each
    // platform then comes back to the setup step, where the member continues.
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

/**
 * The run once a sign-in of a step the member skipped connected anyway,
 * finished in its tab after the step moved on: that step reads connected.
 * Unchanged for a step that came to anything but a skip.
 */
export const amended = (
  run: ConnectRun,
  platform: Platform,
  outcome: RunOutcome
): ConnectRun => {
  const index = run.steps.findIndex((step) => step.platform === platform);

  return run.outcomes[index]?._tag === "skipped"
    ? {
        ...run,
        outcomes: run.outcomes.map((each, at) =>
          at === index ? outcome : each
        ),
      }
    : run;
};

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

/** The run this browser keeps, or none. */
export const currentRun = (): ConnectRun | null =>
  storage().pipe(
    Option.flatMap((tab) => Option.fromNullOr(tab.getItem(storageKey))),
    Option.flatMap(decodeRun),
    Option.getOrNull
  );

/**
 * The workspace of the run that holds `platform`'s sign-in: what a callback
 * page finishes for, in a tab the run opened, which remembers no
 * connection of its own (`pending-connection.ts`). Any step of it, not only
 * the next: a member who skipped the platform from the step, then finished
 * its sign-in in the other tab anyway, keeps the account.
 */
export const runWorkspaceFor = (platform: Platform): string | null => {
  const run = currentRun();

  return run !== null && run.steps.some((step) => step.platform === platform)
    ? run.workspaceId
    : null;
};

/**
 * The run this browser keeps when `platform`'s sign-in in `workspaceId` is
 * its next step, so the callback page carries it on; none otherwise.
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

/**
 * Listens for the run changing, for `useSyncExternalStore`: in this tab,
 * and in another, whose writes reach this one as storage events.
 */
export const subscribeToRun = (listener: () => void): (() => void) => {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      listener();
    }
  };

  globalThis.addEventListener(changedEvent, listener);
  globalThis.addEventListener("storage", fromOtherTab);

  return () => {
    globalThis.removeEventListener(changedEvent, listener);
    globalThis.removeEventListener("storage", fromOtherTab);
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
