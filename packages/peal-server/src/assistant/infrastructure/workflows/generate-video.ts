import { Effect, Layer, Schema } from "effect";
import { Activity, Workflow, WorkflowEngine } from "effect/workflow";

import { VideoJobs } from "#assistant/application/ports/video-jobs.ts";
import { RunVideoGeneration } from "#assistant/application/run-video-generation.ts";
import { VideoGenerationIdSchema } from "#assistant/domain/video-generation.ts";

// Persisted contract: the tag, the payload, the idempotency key, the
// activity name `generate` and its result schema. Add payload fields with a
// decoding default, never rename or remove one; for anything else, add
// GenerateVideoV2 beside this one. The payload holds the job's id: its
// prompt stays in the assistant's table, and only while it is made.

/** How a run left its job, as the workflow stores it. */
export const GenerateResultSchema = Schema.Literals([
  "succeeded",
  "failed",
  "superseded",
]);

/**
 * Makes one video, which the transaction that recorded its job started.
 * One execution per job, so starting it again does nothing more.
 */
export const GenerateVideoV1 = Workflow.make("GenerateVideoV1", {
  idempotencyKey: ({ generationId }) => generationId,
  payload: { generationId: VideoGenerationIdSchema },
});

// One activity, never retried: a start the provider received is billed,
// so a run is made once. An activity a server stopped in the middle of
// runs again when the workflow resumes: the job then reads `running`, and
// the run fails it `interrupted` without asking anything.
export const GenerateVideoV1Live = GenerateVideoV1.toLayer(
  Effect.fn("GenerateVideoV1")(function* generateVideo({ generationId }) {
    return yield* Activity.make({
      execute: RunVideoGeneration.use((running) => running.run(generationId)),
      name: "generate",
      success: GenerateResultSchema,
    });
  })
);

/**
 * Starts GenerateVideoV1 for a job. A start is a persisted message: inside
 * a TransactionRunner transaction it commits, or rolls back, with the
 * job's row, and the execution only runs after the commit.
 */
export const WorkflowVideoJobs = Layer.effect(
  VideoJobs,
  Effect.gen(function* WorkflowVideoJobs() {
    const engine = yield* WorkflowEngine.WorkflowEngine;

    return VideoJobs.of({
      start: (generationId) =>
        GenerateVideoV1.execute(
          { generationId },
          { detached: true, discard: true }
        ).pipe(
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
          Effect.asVoid,
          Effect.orDie
        ),
    });
  })
);
