import { Cron, DateTime, Duration, Effect } from "effect";
import { ClusterCron } from "effect/cluster";

import { Feeds } from "#publishing/application/feeds/feeds.ts";
import { PlatformQuota } from "#publishing/application/platform-quota.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
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
