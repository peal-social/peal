import { Effect, Schedule, Schema } from "effect";
import { Activity, Workflow } from "effect/workflow";

import { SendPrivateReply } from "#engagement/application/send-private-reply.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";

// Persisted contract: the tag, the payload, the idempotency key, the
// activity name `send` and its result schema. Add payload fields with a
// decoding default, never rename or remove one; for anything else, add
// SendPrivateReplyV2 beside this one. The payload holds the private
// reply's id: its text stays in the engagement tables, never in the
// cluster's.

/** How a run left its private reply, as the workflow stores it. */
export const PrivateReplySendResultSchema = Schema.Literals([
  "settled",
  "superseded",
  "unrecorded",
]);

/**
 * Sends one private reply, which the transaction that journalled it
 * started. One execution per private reply, so starting it again does
 * nothing more.
 */
export const SendPrivateReplyV1 = Workflow.make("SendPrivateReplyV1", {
  idempotencyKey: ({ privateReplyId }) => privateReplyId,
  payload: { privateReplyId: PrivateReplyIdSchema },
});

// A database blip must not strand it: the step retries for about three
// minutes. Each try reads the journal first, so one made after the call
// set out looks the message up instead of sending blindly.
const databaseRetry = Schedule.min([
  Schedule.exponential("200 millis", 2),
  Schedule.spaced("30 seconds"),
]);

export const SendPrivateReplyV1Live = SendPrivateReplyV1.toLayer(
  Effect.fn("SendPrivateReplyV1")(function* sendPrivateReply({
    privateReplyId,
  }) {
    const result = yield* Activity.make({
      execute: SendPrivateReply.use((sending) =>
        sending.run(privateReplyId)
      ).pipe(
        Effect.retry({ schedule: databaseRetry, times: 10 }),
        // Logged by its id alone: the failure may quote the message.
        Effect.catchTag("DatabaseError", () =>
          Effect.logError(
            "A private reply could not be read or recorded: the collection hands it to a person within the hour"
          ).pipe(
            Effect.annotateLogs({ privateReplyId }),
            Effect.as("unrecorded" as const)
          )
        )
      ),
      name: "send",
      success: PrivateReplySendResultSchema,
    });

    return result;
  })
);
