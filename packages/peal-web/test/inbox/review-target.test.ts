import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { InboxReview } from "peal-contract";

import { choiceOnDraft, replyChoice } from "#inbox/composer-choice.ts";
import { attemptFor, reviewTargetOf } from "#inbox/review-target.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

const reviewOf = (
  id: string,
  state: InboxReview["state"],
  writtenAt: string
): InboxReview => ({
  id,
  markedAnswered: false,
  photos: 0,
  rating: 4,
  receivedAt: at(writtenAt),
  reply: null,
  reviewerName: `Synthetic reviewer ${id.slice(-1)}`,
  state,
  text: "Synthetic review.",
  threadId: "00000000-0000-7000-8000-0000000000e1",
  updatedAt: at(writtenAt),
  writtenAt: at(writtenAt),
});

// Latest first, as the server lists them.
const latest = reviewOf(
  "00000000-0000-7000-8000-0000000000a3",
  "new",
  "2026-11-14T10:00:00Z"
);

const waiting = reviewOf(
  "00000000-0000-7000-8000-0000000000a2",
  "new",
  "2026-11-13T10:00:00Z"
);

const answered = reviewOf(
  "00000000-0000-7000-8000-0000000000a1",
  "answered",
  "2026-11-12T10:00:00Z"
);

const makeKey = () => "synthetic-key-2";

describe("whom the review composer answers", () => {
  it("answers the oldest review still waiting until the member chooses one", () => {
    expect(reviewTargetOf([latest, waiting, answered], null)).toBe(waiting);
    expect(
      reviewTargetOf([latest, waiting, answered], replyChoice(answered.id))
    ).toBe(answered);
  });

  it("answers the latest when none waits, and nothing without reviews", () => {
    const done = { ...waiting, state: "answered" as const };

    expect(reviewTargetOf([done, answered], null)).toBe(done);
    expect(reviewTargetOf([], null)).toBeUndefined();
  });

  it("keeps a draft on its review once the member writes, whatever a refresh answers", () => {
    const chosen = choiceOnDraft(null, waiting.id, "Thanks");
    // Answered elsewhere: the next read no longer has it waiting.
    const reread = [latest, { ...waiting, state: "answered" as const }];

    expect(reviewTargetOf(reread, chosen)?.id).toBe(waiting.id);
  });

  it("moves on to the next review waiting once the draft is sent or emptied", () => {
    const older = reviewOf(
      "00000000-0000-7000-8000-0000000000a0",
      "new",
      "2026-11-11T10:00:00Z"
    );

    const reread = [
      latest,
      waiting,
      answered,
      { ...older, state: "answered" as const },
    ];

    // A sent reply leaves no choice; an emptied draft lets go of its pin.
    const emptied = choiceOnDraft(
      choiceOnDraft(null, older.id, "T"),
      older.id,
      ""
    );

    expect([
      reviewTargetOf(reread, null)?.id,
      reviewTargetOf(reread, emptied)?.id,
    ]).toStrictEqual([waiting.id, waiting.id]);
  });

  it("keeps a reply's key for its review, and makes another for another review", () => {
    const attempt = { key: "synthetic-key-1", reviewId: waiting.id };

    expect(attemptFor(attempt, waiting.id, makeKey)).toBe(attempt);
    expect(attemptFor(attempt, latest.id, makeKey)).toStrictEqual({
      key: "synthetic-key-2",
      reviewId: latest.id,
    });
  });
});
