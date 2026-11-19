import type { InboxComment } from "peal-contract";

import type { ComposerChoice } from "#inbox/composer-choice.ts";

// Whom a thread's one composer answers: a draft stays on its comment
// while the thread is read again, as a location's reviews keep theirs
// (`#inbox/composer-choice.ts`). Comments send no idempotency key, so the
// target is all there is to keep.

/**
 * The comment the composer answers: the one the member chose (once the
 * platform deleted it, only if they wrote to it), else the oldest still
 * waiting (the comments come oldest first), else the latest still shown.
 */
export const commentTargetOf = (
  comments: readonly InboxComment[],
  choice: ComposerChoice | null
): InboxComment | undefined =>
  comments.find(
    ({ id, state }) =>
      id === choice?.id && (choice.written || state !== "deleted")
  ) ??
  comments.find(({ state }) => state === "new") ??
  comments.findLast(({ state }) => state !== "deleted");
