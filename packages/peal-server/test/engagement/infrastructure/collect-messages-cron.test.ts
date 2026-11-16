import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Ref } from "effect";

import { CollectMessages } from "#engagement/application/collect-messages.ts";
import { SendPrivateReply } from "#engagement/application/send-private-reply.ts";
import { collectMessagesAt } from "#engagement/infrastructure/crons.ts";
import { DatabaseError } from "#shared/application/database-error.ts";

// The messages' cron hands stranded private replies to a person on its
// own: neither a collection that fails nor one that reads long keeps it
// from that, nor the other way round.

const at = DateTime.makeUnsafe("2026-11-16T10:01:00Z");

const report = { deferred: 0, followed: 0, left: 0, read: 0, stranded: 0 };

const services = (
  calls: Ref.Ref<readonly string[]>,
  collecting: Effect.Effect<typeof report, DatabaseError>,
  handing: Effect.Effect<number, DatabaseError>
) =>
  Layer.mergeAll(
    Layer.succeed(
      CollectMessages,
      CollectMessages.of({
        readBox: () => Effect.succeed("missing"),
        run: () =>
          Ref.update(calls, (before) => [...before, "collect"]).pipe(
            Effect.andThen(collecting)
          ),
      })
    ),
    Layer.succeed(
      SendPrivateReply,
      SendPrivateReply.of({
        run: () => Effect.succeed("superseded"),
        settleStranded: Ref.update(calls, (before) => [
          ...before,
          "handOver",
        ]).pipe(Effect.andThen(handing)),
      })
    )
  );

const failure = Effect.fail(new DatabaseError({ cause: "synthetic" }));

describe("the messages' cron", () => {
  it.effect(
    "hands private replies over first, whatever the collection does",
    () =>
      Effect.gen(function* first() {
        const calls = yield* Ref.make<readonly string[]>([]);

        yield* collectMessagesAt(at).pipe(
          Effect.provide(services(calls, failure, Effect.succeed(1)))
        );

        assert.deepStrictEqual(yield* Ref.get(calls), ["handOver", "collect"]);
      })
  );

  it.effect("still collects when the hand-over fails", () =>
    Effect.gen(function* apart() {
      const calls = yield* Ref.make<readonly string[]>([]);

      yield* collectMessagesAt(at).pipe(
        Effect.provide(services(calls, Effect.succeed(report), failure))
      );

      assert.deepStrictEqual(yield* Ref.get(calls), ["handOver", "collect"]);
    })
  );
});
