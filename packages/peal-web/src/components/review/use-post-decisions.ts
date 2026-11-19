"use client";

import type { Post } from "peal-contract";
import { createContext, use } from "react";

import type { Decision, ListedApproval } from "#posts/bulk.ts";
import type { ReviewFailure } from "#review/failure-text.ts";

/**
 * How a decision ended: taken (`late` for an approval after the post's
 * time, which sent it back to draft), or refused and why.
 */
export type DecisionOutcome =
  | { readonly kind: "approved"; readonly late: boolean }
  | { readonly kind: "sentBack" }
  | { readonly kind: "refused"; readonly failure: ReviewFailure };

/** What a list of posts decides with, from its rows and its choice. */
export interface PostDecisions {
  readonly approve: (decision: Decision<Post>) => Promise<DecisionOutcome>;
  /** Whether a decision runs or waits its turn, which holds every other. */
  readonly busy: boolean;
  /** The posts among these that can be decided on, with their approvals. */
  readonly decisionsOf: (posts: readonly Post[]) => readonly Decision<Post>[];
  /**
   * Whether the list of approvals that wait was read and names the post's,
   * or null while it is read. A post it leaves out (it holds 100 at most)
   * reads its own review.
   */
  readonly listed: (postId: string) => boolean | null;
  /** The approvals a post's own review gives, or null to forget them. */
  readonly remember: (
    postId: string,
    approvals: readonly ListedApproval[] | null
  ) => void;
  readonly requestChanges: (
    decision: Decision<Post>,
    comment: string
  ) => Promise<DecisionOutcome>;
}

const refusedOutright = async (): Promise<DecisionOutcome> =>
  await Promise.resolve({
    failure: { _tag: "Unexpected" },
    kind: "refused",
  });

const noDecisions: readonly Decision<Post>[] = [];

/** Outside a list where the member may approve, nothing is decided. */
export const PostDecisionsContext = createContext<PostDecisions>({
  approve: refusedOutright,
  busy: false,
  decisionsOf: () => noDecisions,
  listed: () => null,
  remember: () => {
    // Nothing is decided here, so nothing is kept.
  },
  requestChanges: refusedOutright,
});

/**
 * Decides on posts of a list that wait for an approval, as
 * `PostDecisionsProvider` gives it: approves, or sends back to draft with
 * a comment, naming the approval read, so a post that changed since is
 * refused (ApprovalChanged); one decision at a time for the whole list.
 */
export const usePostDecisions = (): PostDecisions => use(PostDecisionsContext);
