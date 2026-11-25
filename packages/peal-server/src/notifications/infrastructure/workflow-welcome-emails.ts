import { Effect, Layer, Option } from "effect";
import {
  EntityAddress,
  EntityId,
  EntityType,
  MessageStorage,
  ShardId,
} from "effect/cluster";
import { WorkflowEngine } from "effect/workflow";

import { WelcomeEmails } from "#notifications/application/welcome-emails.ts";
import { WelcomeSigner } from "#notifications/application/welcome-signer.ts";
import { DatabaseError } from "#shared/application/database-error.ts";

import { WelcomeV1 } from "./workflows/welcome.ts";

// Where the cluster keeps a run of WelcomeV1 and its clocks, as Effect names
// them, like cluster-retention.ts: its tests run on every Effect upgrade.
const entityTypes = [`Workflow/${WelcomeV1._tag}`, "Workflow/-/DurableClock"];

// The storage finds an entity's rows by its type and its id, whatever shard
// they are on.
const anyShard = ShardId.make("default", 1);

/**
 * Starts WelcomeV1 for a new account, and nothing on a server without a
 * signer. It is detached: making the account never waits for it. Forgetting
 * one deletes its rows from the cluster's storage, which a run in progress
 * does not need to end: what it stores after names nobody.
 */
export const WorkflowWelcomeEmails = Layer.effect(
  WelcomeEmails,
  Effect.gen(function* WorkflowWelcomeEmails() {
    const engine = yield* WorkflowEngine.WorkflowEngine;
    const signer = yield* WelcomeSigner;
    const storage = yield* MessageStorage.MessageStorage;

    return WelcomeEmails.of({
      forget: Effect.fn("WelcomeEmails.forget")(function* forget(userId) {
        const entityId = EntityId.make(
          yield* WelcomeV1.executionId({ userId })
        );

        yield* Effect.forEach(
          entityTypes,
          (entityType) =>
            storage.clearAddress(
              EntityAddress.make({
                entityId,
                entityType: EntityType.make(entityType),
                shardId: anyShard,
              })
            ),
          { discard: true }
        ).pipe(Effect.mapError((cause) => new DatabaseError({ cause })));
      }),
      start: (userId) =>
        Option.isNone(signer.name)
          ? Effect.void
          : WelcomeV1.execute(
              { userId },
              { detached: true, discard: true }
            ).pipe(
              Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
              Effect.asVoid
            ),
    });
  })
);
