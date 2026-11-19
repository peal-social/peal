"use client";

import { CheckIcon, MessageSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Post } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useState } from "react";

import { RequestChangesDialog } from "#components/review/request-changes-dialog.tsx";
import { usePostDecisions } from "#components/review/use-post-decisions.ts";
import type { DecisionOutcome } from "#components/review/use-post-decisions.ts";
import { failureText } from "#review/failure-text.ts";

/**
 * What a member who may approve does with a post of the list that waits,
 * from its row: approve it, or request changes with a comment, as on the
 * post's page. Nothing shows until the list of approvals names the one it
 * waits for, which a decision names.
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

  const { approve, decisionsOf, requestChanges } =
    usePostDecisions(workspaceId);

  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [decision] = decisionsOf([post]);

  if (decision === undefined) {
    return null;
  }

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

  const approveIt = async () => {
    setBusy(true);

    const outcome = await approve(decision);

    setBusy(false);
    sayHowItWent(outcome);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-start gap-1">
      <Button
        variant="ghost"
        size="xs"
        aria-label={t("approveLabel", { post: title })}
        disabled={busy}
        focusableWhenDisabled
        onClick={() => {
          void approveIt();
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
          setBusy(true);

          const taken = sayHowItWent(await requestChanges(decision, comment));

          setBusy(false);

          if (taken) {
            setAsking(false);
          }

          return taken;
        }}
      />
    </div>
  );
};
