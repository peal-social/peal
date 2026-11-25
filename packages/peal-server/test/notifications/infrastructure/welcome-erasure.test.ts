import { randomInt, randomUUID } from "node:crypto";

import { assert, describe, it } from "@effect/vitest";
import {
  Clock,
  Deferred,
  Duration,
  Effect,
  Layer,
  Logger,
  Schema,
} from "effect";
import { ShardingConfig, SqlMessageStorage } from "effect/cluster";
import { Digest } from "effect/crypto";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import { Mailer } from "#notifications/application/mailer.ts";
import { WelcomeEmails } from "#notifications/application/welcome-emails.ts";
import { WorkflowWelcomeEmails } from "#notifications/infrastructure/workflow-welcome-emails.ts";
import {
  WelcomeV1,
  WelcomeV1Live,
} from "#notifications/infrastructure/workflows/welcome.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import type { UserId } from "#shared/domain/ids.ts";
import { TransactionRunnerLive } from "#shared/infrastructure/transaction-runner-live.ts";
import {
  signedBy,
  TestReaders,
  welcomeReader,
  welcomesSignedBy,
} from "#test/notifications/welcome-support.ts";
import {
  clusterOver,
  DatabaseTest,
  eventuallyNow,
  settle,
} from "#test/publishing/infrastructure/harness.ts";

// What an account's erasure leaves of its welcome in the cluster's tables:
// on Postgres, as the server stores them, in tables of the test's own.

const Storage = SqlMessageStorage.layerWith({
  prefix: "test_welcome_erasure",
}).pipe(Layer.provide([ShardingConfig.layer(), Digest.layerWebCrypto]));

const signer = "Camille Synthetic";

// The storage's ids start with the time they are made at, and the tables are
// kept: each test is at a time no other is, within the ten years to come.
const atATimeOfItsOwn = TestClock.withLive(Clock.currentTimeMillis).pipe(
  Effect.flatMap((now) =>
    TestClock.setTime(
      now + Duration.toMillis(Duration.minutes(randomInt(5_000_000)))
    )
  )
);

// What was logged as an error, which no erasure should cause.
const errors: string[] = [];

const capture = Logger.layer([
  Logger.make(({ logLevel, message }) => {
    if (logLevel === "Error" || logLevel === "Fatal") {
      errors.push(String(message));
    }
  }),
]);

/** A mailer whose sends wait for the test, once asked. */
const heldMailer = Effect.gen(function* heldMailer() {
  const asked = yield* Deferred.make<boolean>();
  const released = yield* Deferred.make<boolean>();

  return {
    asked,
    layer: Layer.succeed(
      Mailer,
      Mailer.of({
        send: () =>
          Deferred.succeed(asked, true).pipe(
            Effect.andThen(Deferred.await(released)),
            Effect.asVoid
          ),
      })
    ),
    released,
  };
});

const serverWith = (mailer: Layer.Layer<Mailer>) =>
  Layer.mergeAll(
    WelcomeV1Live.pipe(Layer.provide(welcomesSignedBy(signer))),
    WorkflowWelcomeEmails.pipe(Layer.provide(signedBy(signer))),
    TransactionRunnerLive
  ).pipe(
    Layer.provideMerge(clusterOver(Storage)),
    Layer.provideMerge(DatabaseTest),
    Layer.provideMerge(Layer.merge(TestReaders.layer, mailer)),
    Layer.provideMerge(capture)
  );

const CountSchema = Schema.Tuple([Schema.Struct({ count: Schema.Int })]);

const counted = (rows: Effect.Effect<readonly object[], unknown>) =>
  rows.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(CountSchema)),
    Effect.map(([{ count }]) => count),
    Effect.orDie
  );

// The messages that name the account, whatever they are.
const rowsNaming = (userId: UserId) =>
  SqlClient.SqlClient.use((sql) =>
    counted(
      sql`SELECT count(*)::int AS count FROM test_welcome_erasure_messages m WHERE m::text LIKE ${`%${userId}%`}`
    )
  );

// What its welcome's run and clocks have: messages, and replies to them.
const rowsOf = (userId: UserId) =>
  Effect.gen(function* rows() {
    const sql = yield* SqlClient.SqlClient;
    const executionId = yield* WelcomeV1.executionId({ userId });

    const messages = yield* sql<{ readonly id: string }>`
      SELECT id::text AS id FROM test_welcome_erasure_messages
      WHERE entity_id = ${executionId}`;

    return messages.map(({ id }) => id);
  }).pipe(Effect.orDie);

const repliesTo = (requests: readonly string[]) =>
  SqlClient.SqlClient.use((sql) =>
    counted(
      sql`SELECT count(*)::int AS count FROM test_welcome_erasure_replies WHERE request_id::text = ANY(string_to_array(${requests.join(",")}, ','))`
    )
  );

const newAccount = Effect.gen(function* newAccount() {
  const userId = UserIdSchema.make(randomUUID());

  yield* TestReaders.use((readers) => readers.set(userId, welcomeReader));

  return userId;
});

const start = (userId: UserId) =>
  WelcomeEmails.use((welcomes) => welcomes.start(userId));

const forget = (userId: UserId) =>
  WelcomeEmails.use((welcomes) => welcomes.forget(userId));

const inTransaction = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TransactionRunner.use(({ transaction }) => transaction(effect));

const readsOf = (userId: UserId) =>
  TestReaders.use((readers) => readers.readsOf(userId));

const accepting = Layer.succeed(Mailer, Mailer.of({ send: () => Effect.void }));

const timeout = 60_000;

describe("an erased account's welcome", () => {
  it.effect(
    "leaves no row while it waits, and wakes nothing",
    () =>
      Effect.gen(function* waiting() {
        yield* atATimeOfItsOwn;

        yield* Effect.gen(function* running() {
          const userId = yield* newAccount;

          yield* start(userId);
          yield* settle();

          const stored = yield* rowsOf(userId);

          assert.isAbove(yield* rowsNaming(userId), 0);
          assert.isAbove(stored.length, 1);

          yield* inTransaction(forget(userId));

          assert.deepStrictEqual(yield* rowsOf(userId), []);
          assert.strictEqual(yield* repliesTo(stored), 0);

          yield* TestClock.adjust(Duration.minutes(6));
          yield* settle();

          assert.strictEqual(yield* readsOf(userId), 0);
          assert.deepStrictEqual(yield* rowsOf(userId), []);
        }).pipe(Effect.provide(serverWith(accepting)));
      }),
    timeout
  );

  it.effect(
    "leaves no row once it went out",
    () =>
      Effect.gen(function* finished() {
        yield* atATimeOfItsOwn;

        yield* Effect.gen(function* running() {
          const userId = yield* newAccount;

          yield* start(userId);
          yield* settle();
          yield* TestClock.adjust(Duration.minutes(5));

          yield* eventuallyNow(
            "the account was read",
            readsOf(userId).pipe(Effect.map((count) => count === 1))
          );
          yield* settle();

          const stored = yield* rowsOf(userId);

          assert.isAbove(yield* repliesTo(stored), 0);

          yield* inTransaction(forget(userId));

          assert.deepStrictEqual(yield* rowsOf(userId), []);
          assert.strictEqual(yield* repliesTo(stored), 0);
          assert.strictEqual(yield* rowsNaming(userId), 0);
        }).pipe(Effect.provide(serverWith(accepting)));
      }),
    timeout
  );

  it.effect(
    "keeps its rows when the erasure rolls back",
    () =>
      Effect.gen(function* rolledBack() {
        yield* atATimeOfItsOwn;

        yield* Effect.gen(function* running() {
          const userId = yield* newAccount;

          yield* start(userId);
          yield* settle();

          const before = yield* rowsNaming(userId);

          yield* inTransaction(
            forget(userId).pipe(
              Effect.andThen(Effect.fail("the erasure failed" as const))
            )
          ).pipe(Effect.flip);

          assert.strictEqual(yield* rowsNaming(userId), before);

          // It goes on.
          yield* TestClock.adjust(Duration.minutes(5));

          yield* eventuallyNow(
            "the account was read",
            readsOf(userId).pipe(Effect.map((count) => count === 1))
          );

          yield* settle();
          yield* inTransaction(forget(userId));
        }).pipe(Effect.provide(serverWith(accepting)));
      }),
    timeout
  );

  it.effect(
    "names the account nowhere though it was being sent, and ends",
    () =>
      Effect.gen(function* midCheck() {
        yield* atATimeOfItsOwn;

        const held = yield* heldMailer;

        errors.length = 0;

        yield* Effect.gen(function* running() {
          const userId = yield* newAccount;

          yield* start(userId);
          yield* settle();
          yield* TestClock.adjust(Duration.minutes(5));

          yield* eventuallyNow(
            "the welcome was being sent",
            Deferred.isDone(held.asked)
          );

          yield* inTransaction(forget(userId));
          yield* TestReaders.use((readers) => readers.set(userId, null));

          assert.strictEqual(yield* rowsNaming(userId), 0);

          yield* Deferred.succeed(held.released, true);
          yield* settle();
          yield* TestClock.adjust(Duration.hours(2));
          yield* settle();

          assert.strictEqual(yield* rowsNaming(userId), 0);
          assert.strictEqual(yield* readsOf(userId), 1);
          assert.deepStrictEqual(errors, []);
        }).pipe(Effect.provide(serverWith(held.layer)));
      }),
    timeout
  );

  it.effect(
    "names the account nowhere though the server stopped as it was sent",
    () =>
      Effect.gen(function* midStop() {
        yield* atATimeOfItsOwn;

        const held = yield* heldMailer;

        errors.length = 0;

        const userId = UserIdSchema.make(randomUUID());

        yield* Effect.gen(function* running() {
          yield* TestReaders.use((readers) =>
            readers.set(userId, welcomeReader)
          );

          yield* start(userId);
          yield* settle();
          yield* TestClock.adjust(Duration.minutes(5));

          yield* eventuallyNow(
            "the welcome was being sent",
            Deferred.isDone(held.asked)
          );

          yield* inTransaction(forget(userId));

          // A server that stops now leaves the send unanswered.
          assert.strictEqual(yield* rowsNaming(userId), 0);
        }).pipe(Effect.provide(serverWith(held.layer)));

        // The next one finds nothing to take up.
        yield* Effect.gen(function* restarted() {
          yield* TestClock.adjust(Duration.hours(2));
          yield* settle();

          assert.strictEqual(yield* readsOf(userId), 0);
        }).pipe(Effect.provide(serverWith(accepting)));
      }),
    timeout
  );
});
