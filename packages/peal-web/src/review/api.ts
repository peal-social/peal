import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The queries and mutations of reviews: a workspace's approval policy, the
// approvals that wait, a post's comments, decisions and links. A mutation
// passes `reactivityKeys: reviewKeys`, which refreshes every review query,
// and `postsKeys` too when it changes a post's status.

export const reviewKeys = ["review"];

/** The workspace's approval policy. */
export const reviewSettings = (workspaceId: string) =>
  PealApi.query("approvals", "settings", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: reviewKeys,
  });

/** The approvals that wait in the workspace. */
export const pendingApprovals = (workspaceId: string) =>
  PealApi.query("approvals", "list", {
    headers: forWorkspace(workspaceId),
    // A post taken back or scheduled elsewhere no longer waits.
    reactivityKeys: [...reviewKeys, "posts"],
  });

/** A post's comments and approvals. */
export const postReview = (workspaceId: string, postId: string) =>
  PealApi.query("approvals", "get", {
    headers: forWorkspace(workspaceId),
    params: { postId },
    reactivityKeys: [...reviewKeys, "posts"],
  });

/** A post's review links. */
export const reviewLinks = (workspaceId: string, postId: string) =>
  PealApi.query("approvals", "listLinks", {
    headers: forWorkspace(workspaceId),
    params: { postId },
    reactivityKeys: reviewKeys,
  });

export const updateReviewSettings = PealApi.mutation(
  "approvals",
  "updateSettings"
);

export const addComment = PealApi.mutation("approvals", "comment");

export const resolveThread = PealApi.mutation("approvals", "resolve");

export const approvePost = PealApi.mutation("approvals", "approve");

export const requestPostChanges = PealApi.mutation(
  "approvals",
  "requestChanges"
);

export const createReviewLink = PealApi.mutation("approvals", "createLink");

export const revokeReviewLink = PealApi.mutation("approvals", "revokeLink");

/** What a review link shows, to whoever holds its token. */
export const openReviewLink = (token: string) =>
  PealApi.query("reviewLink", "open", {
    headers: { "x-review-token": token },
    reactivityKeys: ["review-link"],
  });

export const visitorComment = PealApi.mutation("reviewLink", "comment");

export const visitorApprove = PealApi.mutation("reviewLink", "approve");

export const visitorRequestChanges = PealApi.mutation(
  "reviewLink",
  "requestChanges"
);
