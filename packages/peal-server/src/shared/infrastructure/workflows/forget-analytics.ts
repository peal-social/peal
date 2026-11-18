import { Duration, Effect, Layer, Option, Schedule, Schema } from "effect";
import {
  Activity,
  DurableClock,
  Workflow,
  WorkflowEngine,
} from "effect/workflow";

import { AnalyticsDelivery } from "#shared/application/analytics-delivery.ts";
import { AnalyticsErasures } from "#shared/application/analytics-erasures.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import {
  distinctIdsOf,
  erasureGivenUp,
  ProductAnalytics,
} from "#shared/application/product-analytics.ts";
import type { Erased } from "#shared/application/product-analytics.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";

// Persisted contract: the tag, the payload, the idempotency key, the
// activity names `attempt/<n>`, the clock names `retry/<n>`, and the
// result schema. Add payload fields with a decoding default, never rename
// or remove one; for anything else, add ForgetAnalyticsV2 beside this one.

/** How one attempt ended, as the workflow stores it. */
export const ForgetResultSchema = Schema.Literals([
  "deleted",
  "manual",
  "failed",
]);

/**
 * Deletes an erasure's persons at PostHog, which the erasure's
 * transaction started: one execution per erasure (`key`), so starting it
 * again does nothing more, and a server that stops meanwhile takes it up
 * again where it was.
 */
export const ForgetAnalyticsV1 = Workflow.make("ForgetAnalyticsV1", {
  idempotencyKey: ({ key }) => key,
  payload: {
    key: Schema.String,
    userIds: Schema.Array(UserIdSchema),
    workspaceIds: Schema.Array(WorkspaceIdSchema),
  },
});

/**
 * The waits before each attempt after the first: about a day and a half
 * in all, then the deletion is given up, logged
 * (`peal.erasure.analytics_failed`) and counted for the operator.
 */
export const forgetRetryDelays: readonly Duration.Duration[] = [
  Duration.minutes(1),
  Duration.minutes(10),
  Duration.hours(1),
  Duration.hours(6),
  Duration.hours(24),
];

/** The activity of attempt `number`: persisted contract. */
export const attemptName = (number: number) => `attempt/${number}`;

/** The durable clock before attempt `number + 1`: persisted contract. */
export const retryClockName = (number: number) => `retry/${number}`;

// Within an attempt, a blip of the network is tried again at once.
const quickRetry = { schedule: Schedule.exponential("500 millis"), times: 2 };

// Each attempt is its own activity, so a replay reads how it ended
// instead of deleting again. Before deleting: nothing more is sent about
// them in this process, and nothing queued or in flight about them goes
// out after.
const attempt = (erased: Erased, number: number) =>
  Activity.make({
    execute: Effect.gen(function* forgetting() {
      const analytics = yield* ProductAnalytics;
      const delivery = yield* AnalyticsDelivery;
      const distinctIds = distinctIdsOf(erased);

      yield* analytics.forget(erased);
      yield* delivery.purge(distinctIds);

      return yield* delivery.forget(distinctIds).pipe(
        Effect.retry(quickRetry),
        Effect.catchTag("AnalyticsErasureFailed", ({ status }) =>
          Effect.logWarning(
            "PostHog did not delete an erasure's persons: tried again later"
          ).pipe(
            Effect.annotateLogs({
              attempt: number,
              "http.response.status_code": status,
            }),
            Effect.as("failed" as const)
          )
        )
      );
    }),
    name: attemptName(number),
    success: ForgetResultSchema,
  });

export const ForgetAnalyticsV1Live = ForgetAnalyticsV1.toLayer(
  Effect.fn("ForgetAnalyticsV1")(function* forgetAnalytics({
    userIds,
    workspaceIds,
  }) {
    const erased: Erased = { userIds, workspaceIds };

    let number = 1;
    let result = yield* attempt(erased, number);

    while (result === "failed") {
      const delay = Option.fromUndefinedOr(forgetRetryDelays[number - 1]);

      if (Option.isNone(delay)) {
        yield* erasureGivenUp(distinctIdsOf(erased));

        break;
      }

      yield* DurableClock.sleep({
        duration: delay.value,
        inMemoryThreshold: Duration.zero,
        name: retryClockName(number),
      });

      number += 1;
      result = yield* attempt(erased, number);
    }
  })
);

/**
 * Starts ForgetAnalyticsV1 for an erasure. A start is a persisted message:
 * inside a TransactionRunner transaction it commits, or rolls back, with
 * the erasure, and runs only after the commit. It is detached: the
 * erasure never waits for PostHog.
 */
export const WorkflowAnalyticsErasures = Layer.effect(
  AnalyticsErasures,
  Effect.gen(function* WorkflowAnalyticsErasures() {
    const engine = yield* WorkflowEngine.WorkflowEngine;

    return AnalyticsErasures.of({
      start: ({ key, userIds, workspaceIds }) =>
        ForgetAnalyticsV1.execute(
          { key, userIds, workspaceIds },
          { detached: true, discard: true }
        ).pipe(
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
          Effect.asVoid,
          // The start is a row in the erasure's transaction: a database
          // that refuses it fails the erasure, which is tried again.
          Effect.mapError((cause) => new DatabaseError({ cause }))
        ),
    });
  })
);
