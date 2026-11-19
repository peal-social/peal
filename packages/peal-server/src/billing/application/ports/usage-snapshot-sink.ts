import { Context, Effect, Layer } from "effect";
import type { DateTime, Option } from "effect";

import type { BillingAccountId } from "#billing/domain/billing-account.ts";

import type { WorkspaceDayState } from "./usage-states.ts";

/** A workspace's day as the snapshot wrote it, with its billing account. */
export interface ToldDayState {
  readonly state: WorkspaceDayState;
  /** None when the accounts could not be read. */
  readonly billingAccountId: Option.Option<BillingAccountId>;
}

/**
 * Where the daily usage snapshot tells the days it wrote, beyond the
 * ledger: product analytics, on a server that sends it. Telling never
 * fails or waits, so the snapshot never stops for it; where nothing is
 * told (`enabled` false), the snapshot reads nothing for it either.
 */
export class UsageSnapshotSink extends Context.Service<
  UsageSnapshotSink,
  {
    readonly enabled: boolean;
    readonly told: (
      day: DateTime.Utc,
      states: readonly ToldDayState[]
    ) => Effect.Effect<void>;
  }
>()("peal-server/billing/application/UsageSnapshotSink") {
  /** Tells nobody: for tests, and where nothing is told. */
  static readonly layerNone = Layer.succeed(
    UsageSnapshotSink,
    UsageSnapshotSink.of({ enabled: false, told: () => Effect.void })
  );
}
