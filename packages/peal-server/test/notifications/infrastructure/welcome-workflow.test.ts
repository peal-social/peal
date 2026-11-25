import { assert, describe, it } from "@effect/vitest";
import type { Context } from "effect";
import { Duration, Effect, Exit, Layer, Scope } from "effect";
import { MessageStorage, ShardingConfig } from "effect/cluster";
import { TestClock } from "effect/testing";

import { WelcomeEmails } from "#notifications/application/welcome-emails.ts";
import { WorkflowWelcomeEmails } from "#notifications/infrastructure/workflow-welcome-emails.ts";
import {
  welcomeChecks,
  WelcomeV1,
  WelcomeV1Live,
} from "#notifications/infrastructure/workflows/welcome.ts";
import { TestMailer } from "#test/notifications/test-mailer.ts";
import {
  senderDigest,
  signedBy,
  TestReaders,
  welcomeReader,
  welcomesSignedBy,
  WelcomeWorld,
} from "#test/notifications/welcome-support.ts";
import {
  clusterOver,
  eventuallyNow,
  setTime,
  settle,
} from "#test/publishing/infrastructure/harness.ts";
import { sampleUserId as userId } from "#test/shared/product-event-samples.ts";

const signer = "Camille Synthetic";

// A server over `storage`, whose welcomes `name` signs, or that sends none.
const serverOver = (
  storage: Context.Context<MessageStorage.MessageStorage>,
  name: string | null = signer
) =>
  Layer.mergeAll(
    WelcomeV1Live.pipe(Layer.provide(welcomesSignedBy(name))),
    WorkflowWelcomeEmails.pipe(Layer.provide(signedBy(name)))
  ).pipe(Layer.provideMerge(clusterOver(Layer.succeedContext(storage))));

const memoryStorage = Layer.build(
  MessageStorage.layerMemory.pipe(Layer.provide(ShardingConfig.layer()))
);

const accountIs = (reader: Parameters<TestReaders["Service"]["set"]>[1]) =>
  TestReaders.use((readers) => readers.set(userId, reader));

const unconfirmed = { ...welcomeReader, emailConfirmed: false };

const start = WelcomeEmails.use((welcomes) => welcomes.start(userId));

const sent = TestMailer.use((mailer) => mailer.sent);

const reads = TestReaders.use((readers) => readers.reads);

const isSent = (count: number) =>
  eventuallyNow(
    `${count} welcomes were sent`,
    sent.pipe(Effect.map((all) => all.length === count))
  );

const isRead = (count: number) =>
  eventuallyNow(
    `the account was read ${count} times`,
    reads.pipe(Effect.map((read) => read === count))
  );

// A server's life: built, `during` it, then stopped.
const whileRunning = <A, E, R>(
  server: ReturnType<typeof serverOver>,
  during: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* running() {
    const life = yield* Scope.make();
    const built = yield* Layer.buildWithScope(server, life);

    yield* during.pipe(Effect.provideContext(built));
    yield* Scope.close(life, Exit.void);
  });

const timeout = 60_000;

describe(WelcomeV1, () => {
  it.effect(
    "sends nothing before five minutes, then once, however often it is started",
    () =>
      Effect.gen(function* once() {
        yield* setTime("2026-11-25T09:00:00Z");
        yield* accountIs(welcomeReader);

        yield* Effect.gen(function* running() {
          yield* start;
          yield* start;
          yield* settle();

          yield* TestClock.adjust(Duration.seconds(299));
          yield* settle();

          assert.strictEqual(yield* reads, 0);

          yield* TestClock.adjust(Duration.seconds(1));
          yield* isSent(1);

          // Nor later, nor started again.
          yield* start;
          yield* TestClock.adjust(Duration.days(1));
          yield* settle();

          assert.deepStrictEqual(
            (yield* sent).map(({ idempotencyKey, sender, to }) => ({
              idempotencyKey,
              sender,
              to,
            })),
            [
              {
                idempotencyKey: `welcome:${userId}:${senderDigest}`,
                sender: "personal",
                to: welcomeReader.email,
              },
            ]
          );
        }).pipe(Effect.provide(serverOver(yield* memoryStorage)));
      }).pipe(Effect.provide(WelcomeWorld)),
    timeout
  );

  it.effect(
    "sends it at the first check that finds the address confirmed",
    () =>
      Effect.gen(function* confirmedLater() {
        yield* setTime("2026-11-25T09:00:00Z");
        yield* accountIs(unconfirmed);

        yield* Effect.gen(function* running() {
          yield* start;
          yield* settle();

          yield* TestClock.adjust(Duration.minutes(5));
          yield* isRead(1);
          yield* settle();

          yield* TestClock.adjust(Duration.minutes(15));
          yield* isRead(2);
          yield* settle();

          // Confirmed forty minutes after the account was made.
          yield* TestClock.adjust(Duration.minutes(20));
          yield* accountIs(welcomeReader);
          yield* settle();

          assert.deepStrictEqual(yield* sent, []);

          yield* TestClock.adjust(Duration.minutes(40));
          yield* isSent(1);

          assert.strictEqual(yield* reads, 3);
        }).pipe(Effect.provide(serverOver(yield* memoryStorage)));
      }).pipe(Effect.provide(WelcomeWorld)),
    timeout
  );

  it.effect(
    "gives up after its last check on an address never confirmed",
    () =>
      Effect.gen(function* neverConfirmed() {
        yield* setTime("2026-11-25T09:00:00Z");
        yield* accountIs(unconfirmed);

        yield* Effect.gen(function* running() {
          yield* start;
          yield* settle();

          for (const [index, wait] of welcomeChecks.entries()) {
            yield* TestClock.adjust(wait);
            yield* isRead(index + 1);
            yield* settle();
          }

          yield* accountIs(welcomeReader);
          yield* TestClock.adjust(Duration.days(3));
          yield* settle();

          assert.strictEqual(yield* reads, welcomeChecks.length);
          assert.deepStrictEqual(yield* sent, []);
        }).pipe(Effect.provide(serverOver(yield* memoryStorage)));
      }).pipe(Effect.provide(WelcomeWorld)),
    timeout
  );

  it.effect(
    "goes on waiting after a restart, and sends it once",
    () =>
      Effect.gen(function* restarts() {
        yield* setTime("2026-11-25T09:00:00Z");
        yield* accountIs(welcomeReader);

        const storage = yield* memoryStorage;

        yield* whileRunning(
          serverOver(storage),
          Effect.gen(function* waiting() {
            yield* start;
            yield* settle();
            yield* TestClock.adjust(Duration.minutes(2));
            yield* settle();
          })
        );

        assert.deepStrictEqual(yield* sent, []);

        yield* whileRunning(
          serverOver(storage),
          Effect.gen(function* goingOn() {
            yield* TestClock.adjust(Duration.minutes(3));
            yield* isSent(1);
            yield* TestClock.adjust(Duration.hours(1));
            yield* settle();
          })
        );

        // Nor after one more.
        yield* whileRunning(serverOver(storage), settle());

        assert.lengthOf(yield* sent, 1);
      }).pipe(Effect.provide(WelcomeWorld)),
    timeout
  );

  it.effect(
    "ends, sending none, on a server restarted without a signer",
    () =>
      Effect.gen(function* turnedOff() {
        yield* setTime("2026-11-25T09:00:00Z");
        yield* accountIs(welcomeReader);

        const storage = yield* memoryStorage;

        yield* whileRunning(
          serverOver(storage),
          Effect.gen(function* waiting() {
            yield* start;
            yield* settle();
            yield* TestClock.adjust(Duration.minutes(2));
          })
        );

        yield* whileRunning(
          serverOver(storage, null),
          Effect.gen(function* off() {
            yield* TestClock.adjust(Duration.minutes(3));
            yield* settle(100);
          })
        );

        // Turned on again, it is over.
        yield* whileRunning(
          serverOver(storage),
          Effect.gen(function* on() {
            yield* TestClock.adjust(Duration.hours(1));
            yield* settle();
          })
        );

        assert.strictEqual(yield* reads, 0);
        assert.deepStrictEqual(yield* sent, []);
      }).pipe(Effect.provide(WelcomeWorld)),
    timeout
  );

  it.effect(
    "starts nothing for an account made while nobody signs it",
    () =>
      Effect.gen(function* neverStarted() {
        yield* setTime("2026-11-25T09:00:00Z");
        yield* accountIs(welcomeReader);

        const storage = yield* memoryStorage;

        yield* whileRunning(
          serverOver(storage, null),
          start.pipe(Effect.andThen(settle()))
        );

        // A server that does sign finds nothing waiting.
        yield* whileRunning(
          serverOver(storage),
          Effect.gen(function* on() {
            yield* TestClock.adjust(Duration.minutes(6));
            yield* settle(100);
          })
        );

        assert.strictEqual(yield* reads, 0);
        assert.deepStrictEqual(yield* sent, []);
      }).pipe(Effect.provide(WelcomeWorld)),
    timeout
  );
});
