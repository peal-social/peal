import { Duration, Effect } from "effect";
import { Activity, DurableClock, Workflow } from "effect/workflow";

import { SendWelcomeEmail } from "#notifications/application/send-welcome-email.ts";
import { WelcomeOutcomeSchema } from "#notifications/domain/welcome.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import type { UserId } from "#shared/domain/ids.ts";

import { retryingDatabase } from "./activity-retry.ts";

// Persisted contract: the tag, the payload, the idempotency key, the
// activity names `attempt/<n>`, the clock names `wait/<n>`, the waits, and
// the outcomes' schema. Add payload fields with a decoding default, never
// rename or remove one; for anything else, add WelcomeV2 beside this one.

/**
 * The wait before each check of the account, the first counted from when it
 * was made and each other from the check before it: about four days in all.
 */
export const welcomeChecks: readonly Duration.Duration[] = [
  Duration.minutes(5),
  Duration.minutes(15),
  Duration.hours(1),
  Duration.hours(6),
  Duration.hours(24),
  Duration.hours(72),
];

/** The activity of check `number`: persisted contract. */
export const attemptName = (number: number) => `attempt/${number}`;

/** The durable clock before check `number`: persisted contract. */
export const waitClockName = (number: number) => `wait/${number}`;

/**
 * Sends an account's welcome at the first check that finds its address
 * confirmed and the transport willing, or never. One execution per account,
 * so starting it again does nothing more, and a server that stops meanwhile
 * takes it up again where it was. A server that dies between the transport
 * taking the email and the check being stored sends it again, which a
 * transport that deduplicates drops.
 */
export const WelcomeV1 = Workflow.make("WelcomeV1", {
  idempotencyKey: ({ userId }) => userId,
  payload: { userId: UserIdSchema },
});

// Each check is its own activity, so a replay reads how it ended instead of
// sending again.
const attempt = (userId: UserId, number: number) =>
  Activity.make({
    execute: SendWelcomeEmail.use((welcomes) => welcomes.deliver(userId)).pipe(
      retryingDatabase
    ),
    name: attemptName(number),
    success: WelcomeOutcomeSchema,
  });

export const WelcomeV1Live = WelcomeV1.toLayer(
  Effect.fn("WelcomeV1")(function* welcome({ userId }) {
    for (const [index, duration] of welcomeChecks.entries()) {
      const number = index + 1;

      yield* DurableClock.sleep({
        duration,
        inMemoryThreshold: Duration.zero,
        name: waitClockName(number),
      });

      const outcome = yield* attempt(userId, number);

      if (outcome !== "wait") {
        return;
      }
    }
  })
);
