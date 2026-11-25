import type { Post } from "peal-contract";

/** The composer's names for its post, in `Posts.Composer`. */
export type ComposerTitle =
  | "awaitingTitle"
  | "closedTitle"
  | "editTitle"
  | "newTitle"
  | "scheduledTitle";

/**
 * What the panel's header calls the composer's post: a new post until its
 * first save, which makes it a draft at its own address while the page
 * stays; then its status.
 */
export const composerTitleOf = (
  post: Post | undefined,
  saved: boolean
): ComposerTitle => {
  if (post === undefined) {
    return saved ? "editTitle" : "newTitle";
  }

  if (post.status === "draft") {
    return "editTitle";
  }

  if (post.status === "awaitingApproval") {
    return "awaitingTitle";
  }

  return post.status === "scheduled" ? "scheduledTitle" : "closedTitle";
};
