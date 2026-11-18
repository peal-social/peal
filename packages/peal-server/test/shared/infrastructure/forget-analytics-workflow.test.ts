import { assert, describe, it } from "@effect/vitest";
import type { Context } from "effect";
import {
  Duration,
  Effect,
  Exit,
  Layer,
  Metric,
  Ref,
  Schema,
  Scope,
} from "effect";
import { MessageStorage, ShardingConfig } from "effect/cluster";
import { TestClock } from "effect/testing";

import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import { AnalyticsErasureFailed } from "#shared/application/analytics-erasure-failed.ts";
import { AnalyticsErasures } from "#shared/application/analytics-erasures.ts";
import { AnalyticsScope } from "#shared/application/analytics-scope.ts";
import {
  ProductAnalytics,
  productAnalyticsErasures,
} from "#shared/application/product-analytics.ts";
import {
  ForgetAnalyticsV1,
  ForgetAnalyticsV1Live,
  forgetRetryDelays,
  WorkflowAnalyticsErasures,
} from "#shared/infrastructure/workflows/forget-analytics.ts";
import {
  clusterOver,
  eventually,
  setTime,
  settle,
} from "#test/publishing/infrastructure/harness.ts";
import {
  sampleUserId as userId,
  sampleWorkspaceId as workspaceId,
} from "#test/shared/product-event-samples.ts";

type Answer = "fail" | "hang" | "ok";

// What PostHog does with each deletion, and the deletions asked of it:
// shared by the servers a test builds, as PostHog outlives a restart.
interface PostHogState {
  readonly answer: Ref.Ref<Answer>;
  readonly asked: Ref.Ref<readonly (readonly string[])[]>;
  readonly purged: Ref.Ref<readonly string[]>;
}

const deliveryOver = ({ answer, asked, purged }: PostHogState) =>
  Layer.succeed(
    AnalyticsDelivery,
    AnalyticsDelivery.of({
      enabled: true,
      forget: (distinctIds) =>
        Ref.update(asked, (before) => [...before, distinctIds]).pipe(
          Effect.andThen(Ref.get(answer)),
          Effect.flatMap((now) => {
            if (now === "hang") {
              return Effect.never;
            }

            return now === "ok"
              ? Effect.succeed("deleted" as const)
              : Effect.fail(new AnalyticsErasureFailed({ status: 503 }));
          })
        ),
      purge: (distinctIds) =>
        Ref.update(purged, (before) => [...before, ...distinctIds]),
      send: () => Effect.void,
    })
  );

// The server's analytics and the workflow, on a cluster over `storage`.
const serverOver = (
  state: PostHogState,
  storage: Context.Context<MessageStorage.MessageStorage>
) =>
  ForgetAnalyticsV1Live.pipe(
    Layer.provideMerge(
      ProductAnalytics.layer.pipe(
        Layer.provideMerge(WorkflowAnalyticsErasures),
        Layer.provide(AnalyticsScope.layerTest),
        Layer.provideMerge(deliveryOver(state))
      )
    ),
    Layer.provideMerge(clusterOver(Layer.succeedContext(storage)))
  );

const newState = Effect.all({
  answer: Ref.make<Answer>("ok"),
  asked: Ref.make<readonly (readonly string[])[]>([]),
  purged: Ref.make<readonly string[]>([]),
});

const job = {
  key: "erasure:synthetic-1",
  userIds: [userId],
  workspaceIds: [workspaceId],
};

const failedErasures = Metric.value(
  Metric.withAttributes(productAnalyticsErasures, { outcome: "failed" })
).pipe(Effect.map(({ count }) => count));

const memoryStorage = Layer.build(
  MessageStorage.layerMemory.pipe(Layer.provide(ShardingConfig.layer()))
);

const timeout = 60_000;

// What a server before this one stored: it must still decode.
const storedPayload = {
  key: "00000000-0000-7000-8000-0000000000f1",
  userIds: ["6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f"],
  workspaceIds: ["0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"],
};

describe(ForgetAnalyticsV1, () => {
  it.effect("decodes the payload it stored, a persisted contract", () =>
    Effect.gen(function* decodes() {
      const payload = yield* Schema.decodeUnknownEffect(
        Schema.toCodecJson(ForgetAnalyticsV1.payloadSchema)
      )(storedPayload);

      assert.deepStrictEqual(
        [...payload.workspaceIds],
        [...storedPayload.workspaceIds]
      );
    })
  );

  it.effect(
    "deletes an erasure's persons once started, after what was queued about them",
    () =>
      Effect.gen(function* deletes() {
        yield* setTime("2026-11-18T09:00:00Z");

        const state = yield* newState;
        const storage = yield* memoryStorage;

        yield* Effect.gen(function* running() {
          yield* AnalyticsErasures.use((erasures) => erasures.start(job));

          yield* eventually(
            "PostHog was asked",
            Ref.get(state.asked).pipe(Effect.map((asked) => asked.length === 1))
          );

          // Started twice, deleted once.
          yield* AnalyticsErasures.use((erasures) => erasures.start(job));
          yield* settle();

          assert.deepStrictEqual(yield* Ref.get(state.asked), [
            [userId, `workspace:${workspaceId}`],
          ]);
          assert.deepStrictEqual(yield* Ref.get(state.purged), [
            userId,
            `workspace:${workspaceId}`,
          ]);
        }).pipe(Effect.provide(serverOver(state, storage)));
      }),
    timeout
  );

  it.effect(
    "tries again after each delay, then gives up, logged and counted",
    () =>
      Effect.gen(function* givesUp() {
        yield* setTime("2026-11-18T09:00:00Z");

        const state = yield* newState;
        const storage = yield* memoryStorage;
        const before = yield* failedErasures;

        yield* Ref.set(state.answer, "fail");

        yield* Effect.gen(function* running() {
          yield* AnalyticsErasures.use((erasures) => erasures.start(job));

          // Each attempt tries three times, a second or so apart.
          const attempted = (number: number) =>
            Effect.gen(function* attempting() {
              yield* eventually(
                `attempt ${number} started`,
                Ref.get(state.asked).pipe(
                  Effect.map((asked) => asked.length === 3 * (number - 1) + 1)
                )
              );

              yield* TestClock.adjust(Duration.seconds(2));

              yield* eventually(
                `attempt ${number} failed`,
                Ref.get(state.asked).pipe(
                  Effect.map((asked) => asked.length === 3 * number)
                )
              );
            });

          yield* attempted(1);

          for (const [index, delay] of forgetRetryDelays.entries()) {
            yield* TestClock.adjust(delay);
            yield* attempted(index + 2);
          }

          yield* eventually(
            "the deletion was given up",
            failedErasures.pipe(Effect.map((count) => count - before === 1))
          );

          // Nothing more after it.
          yield* TestClock.adjust(Duration.days(2));
          yield* settle();

          assert.lengthOf(
            yield* Ref.get(state.asked),
            3 * (forgetRetryDelays.length + 1)
          );
        }).pipe(Effect.provide(serverOver(state, storage)));
      }),
    timeout
  );

  it.effect(
    "takes up a deletion a restart cut short, where it was",
    () =>
      Effect.gen(function* restarts() {
        yield* setTime("2026-11-18T09:00:00Z");

        const state = yield* newState;
        const storage = yield* memoryStorage;

        yield* Ref.set(state.answer, "hang");

        // The first server starts the deletion, and stops while PostHog
        // has not answered.
        const first = yield* Scope.make();

        const before = yield* Layer.buildWithScope(
          serverOver(state, storage),
          first
        );

        yield* AnalyticsErasures.use((erasures) => erasures.start(job)).pipe(
          Effect.provideContext(before)
        );

        yield* eventually(
          "PostHog was asked",
          Ref.get(state.asked).pipe(Effect.map((asked) => asked.length === 1))
        ).pipe(Effect.provideContext(before));

        yield* Scope.close(first, Exit.void);

        // The next server finds it in storage and deletes.
        yield* Ref.set(state.answer, "ok");

        yield* eventually(
          "PostHog was asked again",
          Ref.get(state.asked).pipe(Effect.map((asked) => asked.length === 2))
        ).pipe(Effect.provide(serverOver(state, storage)));
      }),
    timeout
  );
});
