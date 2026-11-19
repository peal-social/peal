import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Clock, DateTime, Effect, Layer, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { BillingAccounts } from "#billing/application/billing-accounts.ts";
import { AccountDayStore } from "#billing/application/ports/account-day-store.ts";
import { UsageLedger } from "#billing/application/ports/usage-ledger.ts";
import { UsageSnapshotSink } from "#billing/application/ports/usage-snapshot-sink.ts";
import type { ToldDayState } from "#billing/application/ports/usage-snapshot-sink.ts";
import { UsageStates } from "#billing/application/ports/usage-states.ts";
import type { WorkspaceDayState } from "#billing/application/ports/usage-states.ts";
import { SnapshotUsage } from "#billing/application/snapshot-usage.ts";
import { StartAccountDays } from "#billing/application/start-account-days.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  aloneAccountId,
  aloneAccountOf,
  NoMetersTest,
} from "#test/billing/support.ts";

// What the daily snapshot tells product analytics: the day of each
// workspace with a connected account that is still there, with its
// billing account, and nothing it tells stops the run.

const yesterday = DateTime.makeUnsafe("2026-11-10T00:00:00Z");

// In the order of their ids, as the snapshot pages.
const ids = Array.from({ length: 4 }, () =>
  WorkspaceIdSchema.make(randomUUID())
).toSorted();

const idAt = (index: number) =>
  ids[index] ?? WorkspaceIdSchema.make(randomUUID());

const [connected, unconnected, erased, other] = [
  idAt(0),
  idAt(1),
  idAt(2),
  idAt(3),
];

const stateOf = (
  workspaceId: WorkspaceId,
  channels: number
): WorkspaceDayState => ({
  assistantRequests: 4,
  channels,
  mediaStorage: 9_000_000_000,
  members: 2,
  workspaceId,
});

// Two pages of two: the third workspace is erased once its page is read.
const pages: readonly (readonly WorkspaceDayState[])[] = [
  [stateOf(connected, 3), stateOf(unconnected, 0)],
  [stateOf(erased, 5), stateOf(other, 1)],
];

const pageAfter = (after: Option.Option<WorkspaceId>) =>
  Option.match(after, {
    onNone: () => pages[0] ?? [],
    onSome: (last) => (last === unconnected ? (pages[1] ?? []) : []),
  });

const StatesTest = Layer.succeed(
  UsageStates,
  UsageStates.of({
    page: ({ after }) => Effect.succeed(pageAfter(after)),
    workspaces: ({ after }) =>
      Effect.succeed(
        pageAfter(after)
          .map(({ workspaceId }) => workspaceId)
          .filter((id) => id !== erased)
      ),
  })
);

// A ledger that takes every write and keeps none.
const LedgerTest = Layer.mock(UsageLedger, {
  eraseWorkspace: () => Effect.void,
  purgeBefore: () => Effect.succeed(0),
  set: () => Effect.void,
});

const AccountDaysTest = Layer.mergeAll(
  Layer.succeed(
    StartAccountDays,
    StartAccountDays.of({
      pooledOf: () => Effect.succeed(0),
      raiseAccount: () => Effect.void,
      run: Effect.succeed({ accounts: 0, started: 0 }),
    })
  ),
  Layer.mock(AccountDayStore, { purgeBefore: () => Effect.succeed(0) })
);

const accountsThat = (readable: boolean) =>
  Layer.mock(BillingAccounts, {
    accountsIn: (workspaceIds) =>
      readable
        ? Effect.succeed(
            new Map(workspaceIds.map((id) => [id, aloneAccountOf(id)]))
          )
        : Effect.fail(new DatabaseError({ cause: "synthetic" })),
    repair: () => Effect.succeed({ lapsed: 0, repaired: 0 }),
    sweepIn: () => Effect.succeed(0),
  });

// What the sink was told, call by call.
interface Told {
  readonly day: DateTime.Utc;
  readonly states: readonly ToldDayState[];
}

const recordingSink = (told: Ref.Ref<readonly Told[]>) =>
  Layer.succeed(
    UsageSnapshotSink,
    UsageSnapshotSink.of({
      told: (day, states) =>
        Ref.update(told, (before) => [...before, { day, states }]),
    })
  );

const DyingSink = Layer.succeed(
  UsageSnapshotSink,
  UsageSnapshotSink.of({ told: () => Effect.die("synthetic") })
);

const snapshotWith = (
  accounts: ReturnType<typeof accountsThat>,
  sink: Layer.Layer<UsageSnapshotSink>
) =>
  SnapshotUsage.make(2).pipe(
    Layer.provide(
      Layer.mergeAll(
        StatesTest,
        LedgerTest,
        accounts,
        AccountDaysTest,
        NoMetersTest,
        sink
      )
    )
  );

// The run, at 00:11 UTC on 11 November, on a clock of its own.
const runAtMidnight = Effect.gen(function* runAtMidnight() {
  const snapshot = yield* SnapshotUsage;
  const clock = yield* TestClock.make();

  yield* clock.setTime(
    DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-11T00:11:00Z"))
  );

  return yield* snapshot.run.pipe(Effect.provideService(Clock.Clock, clock));
});

const toldNow = Ref.makeUnsafe<readonly Told[]>([]);

layer(snapshotWith(accountsThat(true), recordingSink(toldNow)))(
  "the snapshot's days told",
  (it) => {
    it.effect(
      "tells each workspace with a connected account still there, with its billing account",
      () =>
        Effect.gen(function* tells() {
          const run = yield* runAtMidnight;

          assert.strictEqual(run.workspaces, 4);

          assert.deepStrictEqual(yield* Ref.get(toldNow), [
            {
              day: yesterday,
              states: [
                {
                  billingAccountId: Option.some(aloneAccountId),
                  state: stateOf(connected, 3),
                },
              ],
            },
            {
              day: yesterday,
              states: [
                {
                  billingAccountId: Option.some(aloneAccountId),
                  state: stateOf(other, 1),
                },
              ],
            },
          ]);
        })
    );
  }
);

const toldUnread = Ref.makeUnsafe<readonly Told[]>([]);

layer(snapshotWith(accountsThat(false), recordingSink(toldUnread)))(
  "the snapshot's days told, the billing accounts unreadable",
  (it) => {
    it.effect("tells them without an account, and the run goes on", () =>
      Effect.gen(function* unread() {
        const run = yield* runAtMidnight;

        assert.strictEqual(run.workspaces, 4);
        assert.deepStrictEqual(
          (yield* Ref.get(toldUnread)).flatMap(({ states }) => states),
          [
            { billingAccountId: Option.none(), state: stateOf(connected, 3) },
            { billingAccountId: Option.none(), state: stateOf(other, 1) },
          ]
        );
      })
    );
  }
);

layer(snapshotWith(accountsThat(true), DyingSink))(
  "the snapshot's days told to a sink that dies",
  (it) => {
    it.effect("writes and answers as before", () =>
      Effect.gen(function* dying() {
        const run = yield* runAtMidnight;

        assert.strictEqual(run.workspaces, 4);
        assert.deepStrictEqual(run.day, yesterday);
      })
    );
  }
);
