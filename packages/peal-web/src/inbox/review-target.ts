import type { InboxReview } from "peal-contract";

// Whom a location's one composer answers, and under which key: a draft
// stays on its review while the reviews are read again, and a reply to
// another review never reuses the key of the first.

/**
 * The review the composer answers: the one the member chose, else the
 * oldest still waiting (the reviews come latest first), else the latest.
 */
export const reviewTargetOf = (
  reviews: readonly InboxReview[],
  chosen: string | null
): InboxReview | undefined =>
  reviews.find(({ id }) => id === chosen) ??
  reviews.findLast(({ state }) => state === "new") ??
  reviews[0];

/**
 * What the member has chosen once they write to `targetId`: the review
 * they picked, else the one the composer showed, so a refresh that
 * answers it elsewhere cannot move the draft to another reviewer.
 */
export const pinnedOnWrite = (
  chosen: string | null,
  targetId: string
): string => chosen ?? targetId;

/** The idempotency key of a reply, and the review it answers. */
export interface ReplyAttempt {
  readonly key: string;
  readonly reviewId: string;
}

/**
 * The attempt a reply to `reviewId` goes under: the one kept when it
 * answers that review, a new one from `makeKey` otherwise.
 */
export const attemptFor = (
  attempt: ReplyAttempt,
  reviewId: string,
  makeKey: () => string
): ReplyAttempt =>
  attempt.reviewId === reviewId ? attempt : { key: makeKey(), reviewId };
