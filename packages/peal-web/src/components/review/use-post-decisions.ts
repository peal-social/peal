"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import type { ApprovalRequest, Post } from "peal-contract";

import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { postsKeys } from "#posts/api.ts";
import { decisionsOf } from "#posts/bulk.ts";
import type { Decision } from "#posts/bulk.ts";
import { failureOf } from "#posts/outcome.ts";
import {
  approvePost,
  pendingApprovals,
  requestPostChanges,
  reviewKeys,
} from "#review/api.ts";
import type { ReviewFailure } from "#review/failure-text.ts";

const noApprovals: readonly ApprovalRequest[] = [];

const unexpected: ReviewFailure = { _tag: "Unexpected" };

/**
 * How a decision ended: taken (`late` for an approval after the post's
 * time, which sent it back to draft), or refused and why.
 */
export type DecisionOutcome =
  | { readonly kind: "approved"; readonly late: boolean }
  | { readonly kind: "sentBack" }
  | { readonly kind: "refused"; readonly failure: ReviewFailure };

/**
 * Decides on posts that wait for an approval from a list of them, through
 * the calls a post's review makes: approves, or sends back to draft with a
 * comment, naming the approval the list of those that wait gave
 * (`review.pending`), so a post that changed since is refused
 * (ApprovalChanged). A plan's refusal opens the upgrade dialog.
 */
export const usePostDecisions = (workspaceId: string) => {
  const approvals = Option.getOrElse(
    AsyncResult.value(useAtomValue(pendingApprovals(workspaceId))),
    () => noApprovals
  );

  const approve = useAtomSet(approvePost, { mode: "promiseExit" });
  const sendBack = useAtomSet(requestPostChanges, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();

  const refusedBy = <A, E extends ReviewFailure>(
    exit: Exit.Exit<A, E>
  ): DecisionOutcome => {
    offerUpgrade(exit, workspaceId);

    return {
      failure: Option.getOrElse(failureOf(exit), () => unexpected),
      kind: "refused",
    };
  };

  return {
    approve: async ({
      post,
      shown,
    }: Decision<Post>): Promise<DecisionOutcome> => {
      const exit = await approve({
        params: { postId: post.id, workspaceId },
        payload: shown,
        reactivityKeys: [...reviewKeys, ...postsKeys],
      });

      return Exit.isSuccess(exit)
        ? { kind: "approved", late: exit.value.late }
        : refusedBy(exit);
    },
    /** The posts among these that can be decided on, with their approvals. */
    decisionsOf: (posts: readonly Post[]): readonly Decision<Post>[] =>
      decisionsOf(posts, approvals),
    requestChanges: async (
      { post, shown }: Decision<Post>,
      comment: string
    ): Promise<DecisionOutcome> => {
      const exit = await sendBack({
        params: { postId: post.id, workspaceId },
        payload: { ...shown, comment },
        reactivityKeys: [...reviewKeys, ...postsKeys],
      });

      return Exit.isSuccess(exit) ? { kind: "sentBack" } : refusedBy(exit);
    },
  };
};
