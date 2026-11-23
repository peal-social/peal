import { Context, DateTime, Effect, Layer, Option } from "effect";

import type { BillingAccount } from "#billing/domain/billing-account.ts";
import {
  isToldDay,
  usageCutoff,
  usageDayOf,
} from "#billing/domain/usage-meter.ts";
import type { UsageRecord } from "#billing/domain/usage-meter.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

import { BillingAccounts } from "./billing-accounts.ts";
import { AccountDayStore } from "./ports/account-day-store.ts";
import { BillingAccountStore } from "./ports/billing-account-store.ts";
import { MeterUsageStore } from "./ports/meter-usage-store.ts";
import { UsageLedger } from "./ports/usage-ledger.ts";
import type { WorkspaceUsageRecord } from "./ports/usage-ledger.ts";
import { UsageSnapshotSink } from "./ports/usage-snapshot-sink.ts";
import type { DayCounters } from "./ports/usage-snapshot-sink.ts";
import { UsageStates } from "./ports/usage-states.ts";
import type { WorkspaceDayState } from "./ports/usage-states.ts";
import { StartAccountDays } from "./start-account-days.ts";

/** What a snapshot did. */
export interface UsageSnapshotRun {
  /** The billing accounts whose day (today) it started. */
  readonly accountDays: number;
  /** The account-days and sent reports deleted, past their 400 days. */
  readonly accountDaysPurged: number;
  /** The day (UTC, its first instant) it wrote the states of. */
  readonly day: DateTime.Utc;
  /** The ledger's rows deleted, past their 400 days. */
  readonly purged: number;
  /** The workspaces whose states it wrote. */
  readonly workspaces: number;
}

/** How many workspaces one batch reads and writes. */
export const snapshotBatchSize = 500;

const noCounters: DayCounters = {
  assistantImages: 0,
  managedAds: 0,
  outboundMessages: 0,
  publishedPosts: 0,
};

// The ledger's counters of a day, added up by workspace: the posts that
// went out across platforms, and each billing meter's units. The states
// the snapshot writes itself are left out.
const dayCountersOf = (
  records: readonly WorkspaceUsageRecord[]
): ReadonlyMap<WorkspaceId, DayCounters> => {
  const counted = new Map<WorkspaceId, DayCounters>();

  for (const { record, workspaceId } of records) {
    const { meter, quantity } = record;

    if (
      meter === "publishedPosts" ||
      meter === "assistantImages" ||
      meter === "managedAds" ||
      meter === "outboundMessages"
    ) {
      const before = counted.get(workspaceId) ?? noCounters;

      counted.set(workspaceId, {
        ...before,
        [meter]: before[meter] + quantity,
      });
    }
  }

  return counted;
};

const recordsOf = (
  day: DateTime.Utc,
  state: WorkspaceDayState
): readonly WorkspaceUsageRecord[] => {
  const recorded = (
    meter: Exclude<UsageRecord["meter"], "publishedPosts">,
    quantity: number
  ): WorkspaceUsageRecord => ({
    record: { day, dimension: "", meter, quantity },
    workspaceId: state.workspaceId,
  });

  return [
    recorded("channels", state.channels),
    recorded("members", state.members),
    recorded("mediaStorage", state.mediaStorage),
    recorded("assistantRequests", state.assistantRequests),
  ];
};

/**
 * The daily snapshot of the usage ledger, for the day (UTC) that just
 * ended: every workspace that existed by its end gets the channels it
 * connected, its members and the media it stores as they stand when the
 * snapshot runs, and the day's assistant requests. It goes through the
 * workspaces by id, a batch at a time, each batch's rows written in one
 * statement, and replaces what a run before wrote, so a second run, or a
 * second server, changes nothing. A day it never ran for keeps no state:
 * none is written for it later. A workspace erased while its batch was
 * written has those rows deleted again. Each batch's workspaces are given
 * their billing account, those nobody read yet included (the sweep), and
 * where product analytics is on, the days of those still there with a
 * connected account are told (`UsageSnapshotSink`), with the billing
 * account each is on, read as stored; nothing told fails the run. Then
 * it starts today's account-days of every billing account
 * (`StartAccountDays`, on a server that bills), and, whether the snapshot
 * went through or not, it deletes the ledger's rows, the account-days, the
 * meters' months and the reports sent past their 400 days.
 */
export class SnapshotUsage extends Context.Service<
  SnapshotUsage,
  { readonly run: Effect.Effect<UsageSnapshotRun, DatabaseError> }
>()("peal-server/billing/application/SnapshotUsage") {
  /** The snapshot, `batchSize` workspaces at a time. */
  static readonly make = (batchSize: number) =>
    Layer.effect(
      SnapshotUsage,
      Effect.gen(function* SnapshotUsageLive() {
        const states = yield* UsageStates;
        const ledger = yield* UsageLedger;
        const accounts = yield* BillingAccounts;
        const startDays = yield* StartAccountDays;
        const meterUsage = yield* MeterUsageStore;
        const accountDays = yield* AccountDayStore;
        const sink = yield* UsageSnapshotSink;
        const store = yield* BillingAccountStore;

        // What the ledger counted that day for a batch's workspaces, in one
        // plain read: a workspace it counted nothing for has every counter
        // at zero, and a read that fails leaves them all without counters.
        const countersOf = (
          day: DateTime.Utc,
          workspaceIds: readonly WorkspaceId[]
        ) =>
          ledger.ofWorkspaces(workspaceIds, { from: day, to: day }).pipe(
            Effect.map((records) => Option.some(dayCountersOf(records))),
            Effect.catchCause((cause) =>
              Effect.logWarning(
                "Reading the ledger's counters of the snapshot's workspaces failed",
                cause
              ).pipe(
                Effect.as(Option.none<ReadonlyMap<WorkspaceId, DayCounters>>())
              )
            )
          );

        // The days of a batch's workspaces worth telling, with the billing
        // accounts the sweep just gave them and the day's counters, each in
        // one plain read that writes nothing: accounts that cannot be read
        // leave them without one, and nothing here stops the snapshot.
        const tell = (day: DateTime.Utc, told: readonly WorkspaceDayState[]) =>
          !sink.enabled || told.length === 0
            ? Effect.void
            : store.accountsIn(told.map(({ workspaceId }) => workspaceId)).pipe(
                Effect.catchCause((cause) =>
                  Effect.logWarning(
                    "Reading the billing accounts of the snapshot's workspaces failed",
                    cause
                  ).pipe(Effect.as(new Map<WorkspaceId, BillingAccount>()))
                ),
                Effect.zip(
                  countersOf(
                    day,
                    told.map(({ workspaceId }) => workspaceId)
                  )
                ),
                Effect.flatMap(([held, counted]) =>
                  sink.told(
                    day,
                    told.map((state) => ({
                      billingAccountId: Option.fromUndefinedOr(
                        held.get(state.workspaceId)?.id
                      ),
                      counters: counted.pipe(
                        Option.map(
                          (counters) =>
                            counters.get(state.workspaceId) ?? noCounters
                        )
                      ),
                      state,
                    }))
                  )
                ),
                Effect.catchCause((cause) =>
                  Effect.logWarning("Telling the snapshot's days failed", cause)
                ),
                Effect.withSpan("SnapshotUsage.tell")
              );

        // Every workspace's states, batch by batch: how many it wrote.
        const snapshot = Effect.fn("SnapshotUsage.snapshot")(function* snapshot(
          today: DateTime.Utc,
          day: DateTime.Utc
        ) {
          let after = Option.none<WorkspaceDayState["workspaceId"]>();
          let workspaces = 0;
          let more = true;

          while (more) {
            const request = {
              after,
              createdBefore: today,
              day,
              limit: batchSize,
            };

            const page = yield* states.page(request);

            yield* ledger.set(page.flatMap((state) => recordsOf(day, state)));

            // A workspace erased between the read and the write had its
            // rows deleted before these came: they go again.
            const still = new Set(yield* states.workspaces(request));

            yield* Effect.forEach(
              page.filter(({ workspaceId }) => !still.has(workspaceId)),
              ({ workspaceId }) => ledger.eraseWorkspace(workspaceId),
              { discard: true }
            );

            // The sweep: each workspace is given its billing account, or
            // the one it belongs on now; one that fails is left to the next
            // read, or run, and stops none of the others.
            yield* accounts.sweepIn(page.map(({ workspaceId }) => workspaceId));

            yield* tell(
              day,
              page.filter(
                (state) => still.has(state.workspaceId) && isToldDay(state)
              )
            );

            workspaces += page.length;
            more = page.length === batchSize;
            after = Option.fromUndefinedOr(page.at(-1)?.workspaceId);
          }

          return workspaces;
        });

        const run = Effect.gen(function* run() {
          const now = yield* DateTime.now;
          const today = usageDayOf(now);
          const day = DateTime.subtract(today, { days: 1 });

          // The purge runs whatever became of the snapshot, so rows past
          // their days go even on a day the states cannot be read.
          const taken = yield* snapshot(today, day).pipe(Effect.exit);

          // Accounts whose billing workspace is gone, and lapsed offers.
          yield* accounts
            .repair(batchSize)
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("Repairing billing accounts failed", cause)
              )
            );

          // Today's account-days, once every workspace has its account; what
          // fails is started by the hourly run (billing.account-days).
          const { started } = yield* startDays.run.pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning(
                "Starting the day's account-days failed",
                cause
              ).pipe(Effect.as({ accounts: 0, started: 0 }))
            )
          );

          const purged = yield* ledger.purgeBefore(usageCutoff(now));

          // The meters' months go with the days, by their month.
          const accountDaysPurged =
            (yield* accountDays.purgeBefore(usageCutoff(now))) +
            (yield* meterUsage.purgeBefore(usageCutoff(now)));

          const workspaces = yield* taken;

          const done: UsageSnapshotRun = {
            accountDays: started,
            accountDaysPurged,
            day,
            purged,
            workspaces,
          };

          return done;
        }).pipe(Effect.withSpan("SnapshotUsage.run"));

        return SnapshotUsage.of({ run });
      })
    );

  static readonly layer = SnapshotUsage.make(snapshotBatchSize);
}
