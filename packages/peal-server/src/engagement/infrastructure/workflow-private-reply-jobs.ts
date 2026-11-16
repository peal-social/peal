import { Effect, Layer } from "effect";
import { WorkflowEngine } from "effect/workflow";

import { PrivateReplyJobs } from "#engagement/application/ports/private-reply-jobs.ts";

import { SendPrivateReplyV1 } from "./workflows/send-private-reply.ts";

/**
 * Starts SendPrivateReplyV1 for a private reply. A start is a persisted
 * message of the cluster, holding its id only: inside a
 * TransactionRunner transaction it commits, or rolls back, with what the
 * transaction writes.
 */
export const WorkflowPrivateReplyJobs = Layer.effect(
  PrivateReplyJobs,
  Effect.gen(function* WorkflowPrivateReplyJobs() {
    const engine = yield* WorkflowEngine.WorkflowEngine;

    return PrivateReplyJobs.of({
      cancel: (privateReplyId) =>
        SendPrivateReplyV1.executionId({ privateReplyId }).pipe(
          Effect.flatMap((executionId) =>
            SendPrivateReplyV1.interrupt(executionId)
          ),
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
          Effect.orDie
        ),
      start: (privateReplyId) =>
        SendPrivateReplyV1.execute(
          { privateReplyId },
          { detached: true, discard: true }
        ).pipe(
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
          Effect.asVoid,
          Effect.orDie
        ),
    });
  })
);
