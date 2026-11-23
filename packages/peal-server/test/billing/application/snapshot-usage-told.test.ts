import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Clock, DateTime, Effect, Layer, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { BillingAccounts } from "#billing/application/billing-accounts.ts";
import { AccountDayStore } from "#billing/application/ports/account-day-store.ts";
import { BillingAccountStore } from "#billing/application/ports/billing-account-store.ts";
import { UsageLedger } from "#billing/application/ports/usage-ledger.ts";
import type { WorkspaceUsageRecord } from "#billing/application/ports/usage-ledger.ts";
import { UsageSnapshotSink } from "#billing/application/ports/usage-snapshot-sink.ts";
import type {
  DayCounters,
  ToldDayState,
} from "#billing/application/ports/usage-snapshot-sink.ts";
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

// What the ledger counted yesterday: posts on two platforms and messages
// for the first workspace, beside a state the snapshot writes itself,
// and nothing for the others.
const counted: readonly WorkspaceUsageRecord[] = [
  {
    record: {
      day: yesterday,
      dimension: "mastodon",
      meter: "publishedPosts",
      quantity: 2,
    },
    workspaceId: connected,
  },
  {
    record: {
      day: yesterday,
      dimension: "x",
      meter: "publishedPosts",
      quantity: 1,
    },
    workspaceId: connected,
  },
  {
    record: {
      day: yesterday,
      dimension: "",
      meter: "outboundMessages",
      quantity: 5,
    },
    workspaceId: connected,
  },
  {
    record: { day: yesterday, dimension: "", meter: "members", quantity: 2 },
    workspaceId: connected,
  },
];

const countedFor: DayCounters = {
  assistantImages: 0,
  managedAds: 0,
  outboundMessages: 5,
  publishedPosts: 3,
};

const nothingCounted: DayCounters = {
  assistantImages: 0,
  managedAds: 0,
  outboundMessages: 0,
  publishedPosts: 0,
};

// A ledger that takes every write and keeps none, and reads the day's
// counters as `readable` says.
const ledgerThat = (readable: "counted" | "failing") =>
  Layer.mock(UsageLedger, {
    eraseWorkspace: () => Effect.void,
    ofWorkspaces: (workspaceIds, { from, to }) =>
      readable === "counted" &&
      DateTime.Equivalence(from, yesterday) &&
      DateTime.Equivalence(to, yesterday)
        ? Effect.succeed(
            counted.filter(({ workspaceId }) =>
              workspaceIds.includes(workspaceId)
            )
          )
        : Effect.fail(new DatabaseError({ cause: "synthetic" })),
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

// The sweep gives every workspace its account; the store then reads them
// as `readable` says: each alone in its own, failing, or never asked.
const accountsThat = (readable: "alone" | "failing" | "never") =>
  Layer.mergeAll(
    Layer.mock(BillingAccounts, {
      repair: () => Effect.succeed({ lapsed: 0, repaired: 0 }),
      sweepIn: () => Effect.succeed(0),
    }),
    Layer.mock(BillingAccountStore, {
      accountsIn: (workspaceIds) => {
        if (readable === "never") {
          return Effect.die("the accounts are read with nothing to tell");
        }

        return readable === "alone"
          ? Effect.succeed(
              new Map(workspaceIds.map((id) => [id, aloneAccountOf(id)]))
            )
          : Effect.fail(new DatabaseError({ cause: "synthetic" }));
      },
    })
  );

// What the sink was told, call by call.
interface Told {
  readonly day: DateTime.Utc;
  readonly states: readonly ToldDayState[];
}

const recordingSink = (told: Ref.Ref<readonly Told[]>) =>
  Layer.succeed(
    UsageSnapshotSink,
    UsageSnapshotSink.of({
      enabled: true,
      told: (day, states) =>
        Ref.update(told, (before) => [...before, { day, states }]),
    })
  );

const DyingSink = Layer.succeed(
  UsageSnapshotSink,
  UsageSnapshotSink.of({ enabled: true, told: () => Effect.die("synthetic") })
);

const snapshotWith = (
  accounts: ReturnType<typeof accountsThat>,
  sink: Layer.Layer<UsageSnapshotSink>,
  ledger: ReturnType<typeof ledgerThat> = ledgerThat("counted")
) =>
  SnapshotUsage.make(2).pipe(
    Layer.provide(
      Layer.mergeAll(
        StatesTest,
        ledger,
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

layer(snapshotWith(accountsThat("alone"), recordingSink(toldNow)))(
  "the snapshot's days told",
  (it) => {
    it.effect(
      "tells each workspace with a connected account still there, with its billing account and the day's counters",
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
                  counters: Option.some(countedFor),
                  state: stateOf(connected, 3),
                },
              ],
            },
            {
              day: yesterday,
              states: [
                {
                  billingAccountId: Option.some(aloneAccountId),
                  counters: Option.some(nothingCounted),
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

layer(snapshotWith(accountsThat("failing"), recordingSink(toldUnread)))(
  "the snapshot's days told, the billing accounts unreadable",
  (it) => {
    it.effect("tells them without an account, and the run goes on", () =>
      Effect.gen(function* unread() {
        const run = yield* runAtMidnight;

        assert.strictEqual(run.workspaces, 4);
        assert.deepStrictEqual(
          (yield* Ref.get(toldUnread)).flatMap(({ states }) => states),
          [
            {
              billingAccountId: Option.none(),
              counters: Option.some(countedFor),
              state: stateOf(connected, 3),
            },
            {
              billingAccountId: Option.none(),
              counters: Option.some(nothingCounted),
              state: stateOf(other, 1),
            },
          ]
        );
      })
    );
  }
);

const toldUncounted = Ref.makeUnsafe<readonly Told[]>([]);

layer(
  snapshotWith(
    accountsThat("alone"),
    recordingSink(toldUncounted),
    ledgerThat("failing")
  )
)("the snapshot's days told, the ledger's counters unreadable", (it) => {
  it.effect("tells them without counters, and the run goes on", () =>
    Effect.gen(function* uncounted() {
      const run = yield* runAtMidnight;

      assert.strictEqual(run.workspaces, 4);
      assert.deepStrictEqual(
        (yield* Ref.get(toldUncounted)).flatMap(({ states }) => states),
        [
          {
            billingAccountId: Option.some(aloneAccountId),
            counters: Option.none(),
            state: stateOf(connected, 3),
          },
          {
            billingAccountId: Option.some(aloneAccountId),
            counters: Option.none(),
            state: stateOf(other, 1),
          },
        ]
      );
    })
  );
});

layer(snapshotWith(accountsThat("alone"), DyingSink))(
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

// Product analytics off: the snapshot reads no account for it.
layer(snapshotWith(accountsThat("never"), UsageSnapshotSink.layerNone))(
  "the snapshot's days with product analytics off",
  (it) => {
    it.effect("reads no account for them", () =>
      Effect.gen(function* off() {
        const run = yield* runAtMidnight;

        assert.strictEqual(run.workspaces, 4);
      })
    );
  }
);
