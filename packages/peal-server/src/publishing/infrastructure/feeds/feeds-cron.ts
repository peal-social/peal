import { Cron, DateTime, Duration, Effect, Metric } from "effect";
import { ClusterCron } from "effect/cluster";

import { Feeds } from "#publishing/application/feeds/feeds.ts";

/**
 * How long after it was due an active feed may stay unread before it
 * counts as overdue.
 */
export const feedsOverdueAfter = Duration.hours(1);

const feedsOverdue = Metric.gauge("peal.publishing.feeds.overdue", {
  description: "Active feeds due more than an hour ago and not read",
});

const feedsLeft = Metric.gauge("peal.publishing.feeds.left", {
  description:
    "Feeds still due when the last run ended: not reached before its budget",
});

const feedsDuration = Metric.gauge("peal.publishing.feeds.duration", {
  description: "How long the last run of the feeds took, in seconds",
});

const feedsUnfinished = Metric.counter("peal.publishing.feeds.unfinished", {
  description: "Runs of the feeds that stopped at their budget with feeds due",
  incremental: true,
});

/**
 * Every ten minutes from minute 6: reads the feeds that are due and makes
 * their new items (`Feeds.poll`), on one runner. It calls no platform:
 * each item becomes an ordinary draft, or an ordinary post whose own job
 * publishes it. A run that meets the next one is safe, as each feed is
 * taken under its row's lock, skipped when held, and an item is made once
 * (unique per feed). It stops starting reads eight minutes after its
 * time, says what it made and left, and sets
 * `peal.publishing.feeds.overdue`, which an alert watches.
 */
export const FeedsCron = ClusterCron.make({
  cron: Cron.parseUnsafe("6-59/10 * * * *", "UTC"),
  execute: Effect.gen(function* feeds() {
    const at = yield* ClusterCron.CurrentScheduledTime;
    const started = yield* DateTime.now;
    const service = yield* Feeds;

    // A run that fails still says what is left and late, below.
    const run = yield* service.poll(at).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("Reading the feeds failed", cause).pipe(
          Effect.as({
            failed: 0,
            left: 0,
            made: 0,
            read: 0,
            stopped: 0,
            unfinished: true,
          })
        )
      )
    );

    const ended = yield* DateTime.now;

    yield* Metric.update(
      feedsDuration,
      Duration.toSeconds(DateTime.distance(started, ended))
    );
    yield* Metric.update(feedsLeft, run.left);

    if (run.unfinished) {
      yield* Metric.update(feedsUnfinished, 1);
      yield* Effect.logWarning(
        "The feeds' run stopped at its budget: the feeds left are read by the runs that follow"
      ).pipe(Effect.annotateLogs({ ...run }));
    } else if (run.read > 0) {
      yield* Effect.logInfo("Read the feeds due").pipe(
        Effect.annotateLogs({ ...run })
      );
    }

    yield* Metric.update(
      feedsOverdue,
      yield* service.overdue(
        DateTime.subtractDuration(ended, feedsOverdueAfter)
      )
    );
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning("Reading the feeds failed", cause)
    )
  ),
  name: "publishing.feeds",
  skipIfOlderThan: Duration.minutes(10),
});
