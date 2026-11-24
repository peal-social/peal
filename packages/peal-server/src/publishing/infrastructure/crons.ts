import { Cron, DateTime, Duration, Effect, Metric } from "effect";
import { ClusterCron } from "effect/cluster";

import { Feeds } from "#publishing/application/feeds/feeds.ts";
import { PlatformQuota } from "#publishing/application/platform-quota.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
import { Recycling } from "#publishing/application/recycling.ts";
import { quotaLedgerKeptDays } from "#publishing/domain/quota-retention.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import { addDays, localDateOf } from "#shared/domain/wall-clock.ts";

const utc = TimeZoneIdSchema.make("UTC");

/**
 * Every day at 04:17 UTC: deletes the idempotency keys past their lifetime,
 * the items each feed keeps past its 500 newest, and the hourly counts of
 * the reads members asked for a day old. A key past it is free again
 * whether or not this ran; the run only keeps the tables from growing. A failed run is logged and the next day's
 * catches up.
 */
export const IdempotencyRetentionCron = ClusterCron.make({
  cron: Cron.parseUnsafe("17 4 * * *", "UTC"),
  execute: Effect.gen(function* retention() {
    const deleted = yield* PostScheduling.use(
      (scheduling) => scheduling.forgetExpiredKeys
    );

    // Feeds' items past their newest, and the members' reads a day old.
    const pruned = yield* Feeds.use((feeds) => feeds.prune);

    yield* Effect.logInfo("Purged expired idempotency keys").pipe(
      Effect.annotateLogs({
        deleted,
        feedItems: pruned.items,
        feedReads: pruned.reads,
      })
    );
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Purging expired idempotency keys failed", cause)
    )
  ),
  name: "publishing.idempotency-retention",
  skipIfOlderThan: Duration.hours(12),
});

/**
 * How long after a rule's latest time (a queue's slot included) it may stay
 * unmade before it counts as overdue.
 */
export const recyclingOverdueAfter = Duration.minutes(30);

const overdue = Metric.gauge("peal.publishing.recycling.overdue", {
  description:
    "Active recycling rules a run should have made more than 30 minutes ago, but those it left to wait",
});

/**
 * Every ten minutes from minute 4: makes the occurrences of the recycling
 * rules due (`Recycling.makeDue`), on one runner. It calls no platform: each
 * occurrence is an ordinary post, which its own job publishes. A run that
 * meets the next one is safe, as each rule's row is locked, skipped when
 * held, and an occurrence's place among its rule's posts is unique. It says
 * how many it made, left and ended, then how many rules are overdue
 * (`peal.publishing.recycling.overdue`), which an alert watches.
 */
export const RecyclingCron = ClusterCron.make({
  cron: Cron.parseUnsafe("4-59/10 * * * *", "UTC"),
  execute: Effect.gen(function* recycling() {
    const rules = yield* Recycling;
    const run = yield* rules.makeDue;

    yield* Effect.logInfo("Made the recycling rules' occurrences due").pipe(
      Effect.annotateLogs({ ended: run.ended, left: run.left, made: run.made })
    );

    const late = yield* rules.overdue(
      DateTime.subtractDuration(yield* DateTime.now, recyclingOverdueAfter),
      run
    );

    yield* Metric.update(overdue, late);
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Making the recycling rules' occurrences failed", cause)
    )
  ),
  name: "publishing.recycling",
  skipIfOlderThan: Duration.minutes(10),
});

/**
 * Every day at 04:23 UTC: deletes the quota ledger's days a week past
 * (`PlatformQuota.purge`). Every bucket counts one day, the day a platform
 * counts (Pacific for YouTube, UTC for LinkedIn), so a past day counts
 * nothing, and buckets by member or page would grow the ledger for good.
 * A failed run is logged and the next day's catches up.
 */
export const QuotaRetentionCron = ClusterCron.make({
  cron: Cron.parseUnsafe("23 4 * * *", "UTC"),
  execute: Effect.gen(function* quotaRetention() {
    const now = yield* DateTime.now;

    const deleted = yield* PlatformQuota.use((quota) =>
      quota.purge(addDays(localDateOf(now, utc), -quotaLedgerKeptDays))
    );

    if (deleted > 0) {
      yield* Effect.logInfo("Purged the quota ledger's past days").pipe(
        Effect.annotateLogs({ deleted })
      );
    }
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Purging the quota ledger's past days failed", cause)
    )
  ),
  name: "publishing.quota-retention",
  skipIfOlderThan: Duration.hours(12),
});
