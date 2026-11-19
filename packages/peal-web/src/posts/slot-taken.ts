import { DateTime } from "effect";
import type { Post, PostStatus } from "peal-contract";

// The states in which a post holds its queue's slot, as the server counts
// them: waiting for its time, for an approval, or going out.
const holding: ReadonlySet<PostStatus> = new Set([
  "awaitingApproval",
  "publishing",
  "scheduled",
]);

/**
 * Whether another post of the queue holds its slot at `at`: moving a post
 * of that queue back there would put two posts on one slot.
 */
export const slotTakenBy = (
  posts: readonly Pick<Post, "id" | "queueId" | "schedule" | "status">[],
  {
    at,
    postId,
    queueId,
  }: {
    readonly at: DateTime.DateTime;
    readonly postId: string;
    readonly queueId: string;
  }
): boolean =>
  posts.some(
    (post) =>
      post.id !== postId &&
      post.queueId === queueId &&
      holding.has(post.status) &&
      post.schedule !== null &&
      DateTime.Equivalence(post.schedule.at, at)
  );
