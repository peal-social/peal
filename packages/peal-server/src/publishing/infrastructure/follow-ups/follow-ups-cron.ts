import { Cron, Duration, Effect } from "effect";
import { ClusterCron } from "effect/cluster";

import { FollowUps } from "#publishing/application/follow-ups/follow-ups.ts";

/**
 * Every ten minutes from minute 9: reads the likes analytics last counted
 * of every armed follow-up and sets out those past their rule's threshold
 * (`FollowUps.runDue`), on one runner, then hands over those no job
 * settled (`FollowUps.settleStranded`). It calls no platform itself and
 * makes no read: each follow-up is sent by its own job, through its
 * channel's gate. A run that meets the next one is safe, as each
 * follow-up's row is locked, skipped when held, and moves only from the
 * state it was read in. What it did is counted in
 * `peal.publishing.follow_ups`.
 */
export const FollowUpsCron = ClusterCron.make({
  cron: Cron.parseUnsafe("9-59/10 * * * *", "UTC"),
  execute: Effect.gen(function* followUps() {
    const rules = yield* FollowUps;
    const run = yield* rules.runDue;
    const stranded = yield* rules.settleStranded;

    yield* Effect.logInfo("Ran the follow-up rules").pipe(
      Effect.annotateLogs({ ...run, stranded })
    );
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Running the follow-up rules failed", cause)
    )
  ),
  name: "publishing.follow-ups",
  skipIfOlderThan: Duration.minutes(10),
});
