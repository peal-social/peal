import { Duration, Match } from "effect";
import type { DateTime } from "effect";

import type { AttemptOutcome } from "#shared/domain/attempt-outcome.ts";
import type { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type { RateLimited } from "#shared/domain/rate-limited.ts";

import type {
  ArticleDecision,
  ArticleFailureReason,
  ArticleSettlement,
} from "./article-failure.ts";
import { articleRefusalCodes } from "./article-refusals.ts";

/**
 * How long an article's attempts wait, and how many there are, before it
 * fails: the figures of the posts' policy, which a site's refusals meet
 * the same way (`test/publishing/domain/article-policy.test.ts` keeps them
 * equal).
 */
export const articleRetryPolicy = {
  rateLimit: {
    /** No retry starts later than this after the article was due. */
    deadline: Duration.hours(24),
    /** The wait when the site does not say how long. */
    fallbackDelay: Duration.minutes(1),
    maxAttempts: 8,
    maximumDelay: Duration.hours(6),
    minimumDelay: Duration.seconds(1),
  },
  /** The wait before each retry while the site is unavailable. */
  unavailableBackoff: [
    Duration.minutes(1),
    Duration.minutes(5),
    Duration.minutes(15),
    Duration.hours(1),
    Duration.hours(1),
  ],
};

/**
 * How many earlier attempts of a round ended in each refusal that is
 * retried, the attempt that just ended left out.
 */
export interface ArticleEarlierRefusals {
  readonly rateLimited: number;
  readonly unavailable: number;
}

/** Counts the refusals among a round's earlier attempts. */
export const articleEarlierRefusalsOf = (
  outcomes: readonly AttemptOutcome[]
): ArticleEarlierRefusals => ({
  rateLimited: outcomes.filter(({ _tag }) => _tag === "RateLimited").length,
  unavailable: outcomes.filter(({ _tag }) => _tag === "PlatformUnavailable")
    .length,
});

/** Where the attempt stands. */
export interface ArticleAttemptContext {
  readonly earlier: ArticleEarlierRefusals;
  /** From the time the article was due to the end of the attempt. */
  readonly sinceScheduled: Duration.Duration;
  /** When the attempt's call started: an unconfirmed article may be live since. */
  readonly startedAt: DateTime.Utc;
}

const badRequestReason = (code: string): ArticleFailureReason => {
  if (code === articleRefusalCodes.channelDisconnected) {
    return "channelDisconnected";
  }

  if (code === articleRefusalCodes.channelDisabled) {
    return "channelDisabled";
  }

  return code === articleRefusalCodes.planLimit
    ? "planLimit"
    : "contentRejected";
};

/**
 * Why an article fails when an attempt is refused this way, once nothing
 * is left to try: the site's refusal, or Peal's own when it could not use
 * the channel or a file, or the plan had no room (`./article-refusals.ts`).
 * A site's own code is never read as one of Peal's but those.
 */
export const articleFailureReasonOf = (
  failure: PublishFailure
): ArticleFailureReason =>
  Match.valueTags(failure, {
    BadRequest: ({ code }): ArticleFailureReason => badRequestReason(code),
    MediaRejected: ({ code }): ArticleFailureReason =>
      code === articleRefusalCodes.mediaRemoved
        ? "mediaRemoved"
        : "mediaRejected",
    PlatformUnavailable: (): ArticleFailureReason => "unavailable",
    RateLimited: (): ArticleFailureReason => "rateLimited",
    TokenExpired: (): ArticleFailureReason => "tokenExpired",
  });

const settle = (settlement: ArticleSettlement): ArticleDecision => ({
  _tag: "settle",
  settlement,
});

const giveUp = (reason: ArticleFailureReason, code?: string): ArticleDecision =>
  settle(
    code === undefined
      ? { _tag: "failed", reason }
      : { _tag: "failed", code, reason }
  );

const retry = (delay: Duration.Duration): ArticleDecision => ({
  _tag: "retry",
  delay,
});

const afterUnavailable = (
  { code }: PlatformUnavailable,
  context: ArticleAttemptContext
): ArticleDecision => {
  const delay =
    articleRetryPolicy.unavailableBackoff[context.earlier.unavailable];

  return delay === undefined ? giveUp("unavailable", code) : retry(delay);
};

const afterRateLimit = (
  { code, retryAfter }: RateLimited,
  context: ArticleAttemptContext
): ArticleDecision => {
  const limits = articleRetryPolicy.rateLimit;

  const delay = Duration.clamp(retryAfter ?? limits.fallbackDelay, {
    maximum: limits.maximumDelay,
    minimum: limits.minimumDelay,
  });

  const retryAt = Duration.sum(context.sinceScheduled, delay);

  return context.earlier.rateLimited + 1 >= limits.maxAttempts ||
    Duration.isGreaterThan(retryAt, limits.deadline)
    ? giveUp("rateLimited", code)
    : retry(delay);
};

/**
 * What follows an attempt to send an article, from how it ended: on the
 * site or unconfirmed, it settles; refused, it fails at once with its
 * reason and the code, but for an unavailable site (retried after 1, 5
 * and 15 minutes, then 1 hour twice) and a rate limit (retried after the
 * site's delay, a minute if none, kept between 1 second and 6 hours, 8
 * attempts at most and never past a day after the article was due).
 *
 * The same figures as the posts' policy, for what a site can answer. What
 * the posts' policy has besides is left out, and changes nothing here: a
 * platform refusing the server's app until its operator pays, and a daily
 * allowance spent, are a `PlatformUnavailable` or a `RateLimited` with a
 * code, which only Peal's adapters write and no article path builds; a
 * site's answer never gives one.
 */
export const articleDecide = (
  outcome: AttemptOutcome,
  context: ArticleAttemptContext
): ArticleDecision =>
  Match.valueTags(outcome, {
    BadRequest: (refusal) =>
      giveUp(articleFailureReasonOf(refusal), refusal.code),
    MediaRejected: (refusal) =>
      giveUp(articleFailureReasonOf(refusal), refusal.code),
    PlatformUnavailable: (refusal) => afterUnavailable(refusal, context),
    RateLimited: (refusal) => afterRateLimit(refusal, context),
    TokenExpired: () => giveUp("tokenExpired"),
    published: (published) => settle(published),
    unconfirmed: ({ reason }) =>
      settle({ _tag: "unconfirmed", attemptedAt: context.startedAt, reason }),
  });
