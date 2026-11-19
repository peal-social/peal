import type { InboxComment } from "peal-contract";

// Whom a thread's one composer answers: a draft stays on its comment
// while the thread is read again, as a location's reviews keep theirs
// (`#inbox/review-target.ts`). Comments send no idempotency key, so the
// target is all there is to keep.

/**
 * The comment a member aimed the composer at: by its Reply (`written`
 * false), or by writing to it (`written` true), which pins the draft.
 */
export interface CommentChoice {
  readonly id: string;
  readonly written: boolean;
}

/**
 * The comment the composer answers: the one the member chose (once the
 * platform deleted it, only if they wrote to it), else the oldest still
 * waiting (the comments come oldest first), else the latest still shown.
 */
export const commentTargetOf = (
  comments: readonly InboxComment[],
  choice: CommentChoice | null
): InboxComment | undefined =>
  comments.find(
    ({ id, state }) =>
      id === choice?.id && (choice.written || state !== "deleted")
  ) ??
  comments.find(({ state }) => state === "new") ??
  comments.findLast(({ state }) => state !== "deleted");

/**
 * What the member has chosen once they write to `targetId`, the comment
 * the composer shows: a refresh that answers or deletes it cannot move
 * the draft to another author.
 */
export const writtenTo = (targetId: string): CommentChoice => ({
  id: targetId,
  written: true,
});
