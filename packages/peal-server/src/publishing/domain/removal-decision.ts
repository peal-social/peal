import { Duration, Match, Schema } from "effect";

import { BadRequest } from "#shared/domain/bad-request.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";

import { ownRefusalCodes, platformRefusalCodes } from "./own-refusals.ts";
import { defaultPublicationPolicy } from "./publication-policy.ts";
import type { PublicationPolicy } from "./publication-policy.ts";

/**
 * How one call changing a part of a live post ended: the part is off the
 * platform (`removed`, or `alreadyGone` when the platform had no such
 * post), it shows an edit's text (`edited`), or the platform's refusal.
 * Stored in the job's history: add members, never rename or remove one.
 */
export const RemovalAttemptSchema = Schema.Union([
  Schema.TaggedStruct("removed", { alreadyGone: Schema.Boolean }),
  Schema.TaggedStruct("edited", {}),
  PlatformUnavailable,
  RateLimited,
  TokenExpired,
  BadRequest,
]);

export type RemovalAttempt = typeof RemovalAttemptSchema.Type;

/**
 * What follows a call: the part is off the platform (`removed`), or shows
 * an edit's text (`edited`), try it again after `delay` (`retry`, `rateLimited` when the platform asked to
 * wait, `reached` when the try may have reached the platform), give up with `code` (`failed`), or stop, as the change ended or
 * went with its workspace (`gone`). Stored in the job's history: add
 * members, never rename or remove one.
 */
export const RemovalDecisionSchema = Schema.Union([
  Schema.TaggedStruct("removed", { alreadyGone: Schema.Boolean }),
  Schema.TaggedStruct("retry", {
    delay: Schema.DurationFromMillis,
    rateLimited: Schema.Boolean,
    reached: Schema.optionalKey(Schema.Boolean),
  }),
  Schema.TaggedStruct("failed", { code: Schema.String }),
  Schema.TaggedStruct("gone", {}),
  Schema.TaggedStruct("edited", {}),
]);

export type RemovalDecision = typeof RemovalDecisionSchema.Type;

/** The codes a change fails with when Peal gives up, beside the platforms'. */
export const removalFailureCodes = {
  // The channel was disconnected, turned off, or must be reconnected.
  channelUnavailable: "channelUnavailable",
  // The platform kept asking to wait.
  rateLimited: "rateLimited",
  // The platform could not be reached, every try.
  unavailable: "unavailable",
} as const;

/**
 * The code of a PlatformUnavailable for a call that may have reached the
 * platform: it was sent and timed out, or the platform answered a 5xx. A
 * call that failed before it left (a name that did not resolve, a
 * connection refused, the token unreadable) has no code, and never counts
 * as `reached`.
 */
export const unansweredAfterSending = "unansweredAfterSending";

/**
 * How many earlier calls for the same part ended in each retried refusal,
 * and how many of those may have reached the platform (`reached`).
 */
export interface EarlierRemovals {
  readonly reached: number;
  readonly rateLimited: number;
  readonly unavailable: number;
}

const retry = (
  delay: Duration.Duration,
  rateLimited: boolean,
  reached = false
): RemovalDecision =>
  reached
    ? { _tag: "retry", delay, rateLimited, reached }
    : { _tag: "retry", delay, rateLimited };

const failed = (code: string): RemovalDecision => ({ _tag: "failed", code });

const channelRefusals: ReadonlySet<string> = new Set([
  ownRefusalCodes.channelDisconnected,
  ownRefusalCodes.channelDisabled,
]);

/**
 * An edit's attempt as it ended: a refusal that may be the platform
 * finding the same text again (`editRefusedOrSame`) is the edit applied
 * when an earlier try is known to have reached the platform
 * (`earlier.reached`: sent and timed out, or answered a 5xx), which may
 * have changed the text. A try that failed before it left never counts,
 * nor a call a crash left unfinished, which may not have been sent. Any
 * other attempt stays as it is.
 */
export const editAfterRepeat = (
  attempt: RemovalAttempt,
  earlier: EarlierRemovals
): RemovalAttempt =>
  attempt._tag === "BadRequest" &&
  attempt.code === platformRefusalCodes.editRefusedOrSame &&
  earlier.reached > 0
    ? { _tag: "edited" }
    : attempt;

/**
 * Decides what follows a call. Deleting is safe to repeat (a post found
 * gone is deleted), and so is editing (the same text again), so, unlike a
 * publish, a call that failed is tried again: after the delays the publishing policy waits for an outage
 * (`unavailableBackoff`: five more tries), and, while the platform asks to
 * wait, as long as it says, within the policy's bounds, `maxAttempts`
 * times. A refusal that no retry changes ends the change with its code:
 * the platform's, or Peal's own when the channel cannot be used.
 */
export const decideRemoval = (
  attempt: RemovalAttempt,
  earlier: EarlierRemovals,
  policy: PublicationPolicy = defaultPublicationPolicy
): RemovalDecision =>
  Match.valueTags(attempt, {
    BadRequest: ({ code }) =>
      failed(
        channelRefusals.has(code)
          ? removalFailureCodes.channelUnavailable
          : code
      ),
    PlatformUnavailable: ({ code }) => {
      const delay = policy.unavailableBackoff[earlier.unavailable];
      const reached = code === unansweredAfterSending;

      if (delay === undefined) {
        return failed(
          reached || code === undefined ? removalFailureCodes.unavailable : code
        );
      }

      return retry(delay, false, reached);
    },
    RateLimited: ({ code, retryAfter }) => {
      const limits = policy.rateLimit;

      return earlier.rateLimited + 1 >= limits.maxAttempts
        ? failed(code ?? removalFailureCodes.rateLimited)
        : retry(
            Duration.clamp(retryAfter ?? limits.fallbackDelay, {
              maximum: limits.maximumDelay,
              minimum: limits.minimumDelay,
            }),
            true
          );
    },
    TokenExpired: () => failed(removalFailureCodes.channelUnavailable),
    edited: (): RemovalDecision => ({ _tag: "edited" }),
    removed: ({ alreadyGone }): RemovalDecision => ({
      _tag: "removed",
      alreadyGone,
    }),
  });
