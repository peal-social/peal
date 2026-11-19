"use client";

import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { CheckIcon, MessageSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Post } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useEffect, useState } from "react";

import { RequestChangesDialog } from "#components/review/request-changes-dialog.tsx";
import { usePostDecisions } from "#components/review/use-post-decisions.ts";
import type { DecisionOutcome } from "#components/review/use-post-decisions.ts";
import { postReview } from "#review/api.ts";
import { failureText } from "#review/failure-text.ts";

/**
 * Reads the review of a post the list of approvals that wait leaves out
 * (it holds the 100 oldest), so the list knows the approval it waits for,
 * and forgets it once the row goes.
 */
const ReviewedApproval = ({
  postId,
  workspaceId,
}: {
  readonly postId: string;
  readonly workspaceId: string;
}) => {
  const { remember } = usePostDecisions();

  const approvals = Option.getOrUndefined(
    AsyncResult.value(useAtomValue(postReview(workspaceId, postId)))
  )?.approvals;

  useEffect(() => {
    if (approvals !== undefined) {
      remember(postId, approvals);
    }
  }, [approvals, postId, remember]);

  useEffect(
    () => () => {
      remember(postId, null);
    },
    [postId, remember]
  );

  return null;
};

/**
 * What a member who may approve does with a post of the list that waits,
 * from its row: approve it, or request changes with a comment, as on the
 * post's page. Nothing shows until the approval it waits for is read,
 * which a decision names: from the list of those that wait, or from the
 * post's own review when the list leaves it out. While any decision of the
 * list runs, the buttons wait.
 */
export const PostDecisionActions = ({
  post,
  title,
  workspaceId,
}: {
  readonly post: Post;
  /** What the list calls the post, which names each button for a screen reader. */
  readonly title: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Posts.List");
  const review = useTranslations("Review");

  const { approve, busy, decisionsOf, listed, requestChanges } =
    usePostDecisions();

  const [asking, setAsking] = useState(false);
  const [decision] = decisionsOf([post]);

  const reader =
    listed(post.id) === false ? (
      <ReviewedApproval postId={post.id} workspaceId={workspaceId} />
    ) : null;

  // Says how it went, and whether the decision was taken.
  const sayHowItWent = (outcome: DecisionOutcome): boolean => {
    if (outcome.kind === "refused") {
      toast.error(
        outcome.failure._tag === "ApprovalChanged"
          ? t("approvalChanged")
          : failureText(review, outcome.failure)
      );

      return false;
    }

    if (outcome.kind === "sentBack") {
      toast.success(review("decide.sentBack"));
    } else {
      toast.success(
        review(outcome.late ? "decide.approvedLate" : "decide.approved")
      );
    }

    return true;
  };

  // The reader keeps its place whether or not the buttons show.
  return (
    <>
      {reader}
      {decision === undefined ? null : (
        <div className="flex flex-wrap items-start gap-1">
          <Button
            variant="ghost"
            size="xs"
            aria-label={t("approveLabel", { post: title })}
            disabled={busy}
            focusableWhenDisabled
            onClick={() => {
              void approve(decision).then(sayHowItWent);
            }}
          >
            <CheckIcon aria-hidden />
            {t("approve")}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label={t("requestChangesLabel", { post: title })}
            disabled={busy}
            focusableWhenDisabled
            onClick={() => {
              setAsking(true);
            }}
          >
            <MessageSquareIcon aria-hidden />
            {t("requestChanges")}
          </Button>
          <RequestChangesDialog
            count={1}
            open={asking}
            onOpenChange={setAsking}
            onSubmit={async (comment) => {
              const taken = sayHowItWent(
                await requestChanges(decision, comment)
              );

              if (taken) {
                setAsking(false);
              }

              return taken;
            }}
          />
        </div>
      )}
    </>
  );
};
