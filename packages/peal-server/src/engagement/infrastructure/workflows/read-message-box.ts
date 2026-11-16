import { DateTime, Effect, Schema } from "effect";
import { Activity, Workflow } from "effect/workflow";

import { CollectMessages } from "#engagement/application/collect-messages.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";

// Persisted contract: the tag, the payload, the idempotency key, the
// activity name `read` and its result schema. Add payload fields with a
// decoding default, never rename or remove one; for anything else, add
// ReadMessageBoxV2 beside this one. The payload holds a channel's id and
// an instant: what a platform's event said stays out of the cluster's
// tables.

/** How a run left the box, as the workflow stores it. */
export const BoxReadResultSchema = Schema.Literals([
  "deferred",
  "missing",
  "off",
  "read",
  "unrecorded",
]);

/**
 * Reads one channel's box now, as a platform's event asked: one execution
 * a channel and slot (the event's instant on ten seconds), so a burst of
 * events reads the box once. A read that fails ends here: the collection's
 * schedule reads the box later, and nothing retries in the job.
 */
export const ReadMessageBoxV1 = Workflow.make("ReadMessageBoxV1", {
  idempotencyKey: ({ channelId, slot }) =>
    `${channelId}:${DateTime.formatIso(slot)}`,
  payload: { channelId: ChannelIdSchema, slot: Schema.DateTimeUtc },
});

export const ReadMessageBoxV1Live = ReadMessageBoxV1.toLayer(
  Effect.fn("ReadMessageBoxV1")(function* readMessageBox({ channelId }) {
    const result = yield* Activity.make({
      execute: Effect.gen(function* reading() {
        const collect = yield* CollectMessages;

        return yield* collect.readBox(channelId, yield* DateTime.now);
      }).pipe(
        // Logged by the channel's id alone: the failure may quote messages.
        Effect.catchTag("DatabaseError", () =>
          Effect.logWarning(
            "A channel's box could not be read now: the collection reads it on its schedule"
          ).pipe(
            Effect.annotateLogs({ channelId }),
            Effect.as("unrecorded" as const)
          )
        )
      ),
      name: "read",
      success: BoxReadResultSchema,
    });

    return result;
  })
);
