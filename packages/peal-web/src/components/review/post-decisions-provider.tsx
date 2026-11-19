"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import type { Post } from "peal-contract";
import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { PostDecisionsContext } from "#components/review/use-post-decisions.ts";
import type {
  DecisionOutcome,
  PostDecisions,
} from "#components/review/use-post-decisions.ts";
import { postsKeys } from "#posts/api.ts";
import { decisionsOf } from "#posts/bulk.ts";
import type { Decision, ListedApproval } from "#posts/bulk.ts";
import { failureOf } from "#posts/outcome.ts";
import {
  approvePost,
  pendingApprovals,
  requestPostChanges,
  reviewKeys,
} from "#review/api.ts";
import { oneAfterAnother } from "#review/decision-queue.ts";
import type { ReviewFailure } from "#review/failure-text.ts";

const unexpected: ReviewFailure = { _tag: "Unexpected" };

/**
 * Decides on the posts of a list that wait for an approval, for a member
 * who may approve, through the calls a post's review makes: approves, or
 * sends back to draft with a comment, naming the approval read, from the
 * list of those that wait (`review.pending`, 100 at most) or, for a post
 * it leaves out, from the post's own review. Decisions from the rows and
 * from the choice run one after the other, and every other waits while
 * one runs. A plan's refusal opens the upgrade dialog.
 */
export const PostDecisionsProvider = ({
  children,
  workspaceId,
}: {
  readonly children: ReactNode;
  readonly workspaceId: string;
}) => {
  const pending = AsyncResult.value(
    useAtomValue(pendingApprovals(workspaceId))
  );

  const approve = useAtomSet(approvePost, { mode: "promiseExit" });
  const sendBack = useAtomSet(requestPostChanges, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();
  // One queue for the list, kept across renders.
  const queue = useRef(oneAfterAnother());
  const [running, setRunning] = useState(0);

  // The approvals each post's own review gave, for those the list leaves
  // out.
  const [reviewed, setReviewed] = useState<
    Readonly<Record<string, readonly ListedApproval[]>>
  >({});

  const remember = useCallback(
    (postId: string, approvals: readonly ListedApproval[] | null) => {
      setReviewed((current) => {
        const kept = Object.fromEntries(
          Object.entries(current).filter(([id]) => id !== postId)
        );

        return approvals === null ? kept : { ...kept, [postId]: approvals };
      });
    },
    []
  );

  const refusedBy = <A, E extends ReviewFailure>(
    exit: Exit.Exit<A, E>
  ): DecisionOutcome => {
    offerUpgrade(exit, workspaceId);

    return {
      failure: Option.getOrElse(failureOf(exit), () => unexpected),
      kind: "refused",
    };
  };

  // Runs a decision in its turn, the list busy until it ends.
  const decide = async (
    task: () => Promise<DecisionOutcome>
  ): Promise<DecisionOutcome> => {
    setRunning((count) => count + 1);

    return await queue.current(task).finally(() => {
      setRunning((count) => count - 1);
    });
  };

  const listedApprovals = Option.getOrElse(pending, () => []);

  const known = [...listedApprovals, ...Object.values(reviewed).flat()];

  const decisions: PostDecisions = {
    approve: async ({ post, shown }: Decision<Post>) =>
      await decide(async () => {
        const exit = await approve({
          params: { postId: post.id, workspaceId },
          payload: shown,
          reactivityKeys: [...reviewKeys, ...postsKeys],
        });

        return Exit.isSuccess(exit)
          ? { kind: "approved", late: exit.value.late }
          : refusedBy(exit);
      }),
    busy: running > 0,
    decisionsOf: (posts) => decisionsOf(posts, known),
    listed: (postId) =>
      Option.isNone(pending)
        ? null
        : listedApprovals.some(
            (approval) =>
              approval.postId === postId && approval.status === "pending"
          ),
    remember,
    requestChanges: async ({ post, shown }: Decision<Post>, comment: string) =>
      await decide(async () => {
        const exit = await sendBack({
          params: { postId: post.id, workspaceId },
          payload: { ...shown, comment },
          reactivityKeys: [...reviewKeys, ...postsKeys],
        });

        return Exit.isSuccess(exit) ? { kind: "sentBack" } : refusedBy(exit);
      }),
  };

  return (
    <PostDecisionsContext value={decisions}>{children}</PostDecisionsContext>
  );
};
