import { Effect, Layer, Schema } from "effect";
import { Activity, Workflow, WorkflowEngine } from "effect/workflow";

import { SlideshowJobs } from "#assistant/application/ports/slideshow-jobs.ts";
import { RunSlideshow } from "#assistant/application/run-slideshow.ts";
import { SlideshowIdSchema } from "#assistant/domain/slideshow.ts";

// Persisted contract: the tag, the payload, the idempotency key, the
// activity name `compose` and its result schema. Add payload fields with a
// decoding default, never rename or remove one; for anything else, add
// ComposeSlideshowV2 beside this one. The payload holds the job's id: its
// plan stays in the assistant's table, and only while it is composed.

/** How a run left its job, as the workflow stores it. */
export const ComposeResultSchema = Schema.Literals([
  "succeeded",
  "failed",
  "superseded",
]);

/**
 * Composes one slide video, which the transaction that recorded its job
 * started. One execution per job, so starting it again does nothing more.
 */
export const ComposeSlideshowV1 = Workflow.make("ComposeSlideshowV1", {
  idempotencyKey: ({ slideshowId }) => slideshowId,
  payload: { slideshowId: SlideshowIdSchema },
});

// One activity, never retried: a render the service received is billed,
// so a run is made once. An activity a server stopped in the middle of
// runs again when the workflow resumes: the job then reads `running`, and
// the run fails it `interrupted` without sending anything.
export const ComposeSlideshowV1Live = ComposeSlideshowV1.toLayer(
  Effect.fn("ComposeSlideshowV1")(function* composeSlideshow({ slideshowId }) {
    return yield* Activity.make({
      execute: RunSlideshow.use((running) => running.run(slideshowId)),
      name: "compose",
      success: ComposeResultSchema,
    });
  })
);

/**
 * Starts ComposeSlideshowV1 for a job. A start is a persisted message:
 * inside a TransactionRunner transaction it commits, or rolls back, with
 * the job's row, and the execution only runs after the commit.
 */
export const WorkflowSlideshowJobs = Layer.effect(
  SlideshowJobs,
  Effect.gen(function* WorkflowSlideshowJobs() {
    const engine = yield* WorkflowEngine.WorkflowEngine;

    return SlideshowJobs.of({
      start: (slideshowId) =>
        ComposeSlideshowV1.execute(
          { slideshowId },
          { detached: true, discard: true }
        ).pipe(
          Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
          Effect.asVoid,
          Effect.orDie
        ),
    });
  })
);
