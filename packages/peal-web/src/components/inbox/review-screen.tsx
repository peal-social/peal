"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import {
  inboxReviewRetentionDays,
  isSocialChannel,
  maxInboxReviewReplyBytes,
} from "peal-contract";
import type {
  InboxReview,
  InboxReviewReply,
  InboxReviewThreadDetail,
  SocialChannel,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "peal-ui/components/alert-dialog";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";

import { channelsOf } from "#channels/channels-api.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { choiceOnDraft, replyChoice } from "#inbox/composer-choice.ts";
import type { ComposerChoice } from "#inbox/composer-choice.ts";
import { inboxErrorOf } from "#inbox/errors.ts";
import {
  replyToReview,
  reviewLocation,
  reviewsChanged,
  setReviewAnswered,
  withdrawReviewReply,
} from "#inbox/review-atoms.ts";
import { attemptFor, reviewTargetOf } from "#inbox/review-target.ts";
import type { ReplyAttempt } from "#inbox/review-target.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";

import { useInboxErrorText } from "./inbox-views.tsx";
import {
  ReviewReplyBoxView,
  ReviewSummaryView,
  ReviewView,
} from "./review-views.tsx";

// How often the reviews are read again while the tab is visible, so a
// reply on its way shows how it ended.
const refreshEvery = 30_000;

const bytesOf = (text: string) => new TextEncoder().encode(text.trim()).length;

// Whether a reply to the review is on its way, or may be out.
const isPending = (replies: readonly InboxReviewReply[], reviewId: string) =>
  replies.some(
    (reply) =>
      reply.reviewId === reviewId &&
      (reply.status === "sending" || reply.status === "unconfirmed")
  );

// The quiet buttons under a review, Reply first: whether it needs an
// answer, and taking the location's reply back from Google.
const ReviewActions = ({
  mayAnswer,
  mayWithdraw,
  onReply,
  review,
  workspaceId,
}: {
  /** Whether the member may answer it, and the channel can. */
  readonly mayAnswer: boolean;
  /** Whether the member may delete its reply, and the channel can. */
  readonly mayWithdraw: boolean;
  /** Aims the composer at the review. */
  readonly onReply: () => void;
  readonly review: InboxReview;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxReviews");
  const explain = useInboxErrorText();
  const mark = useAtomSet(setReviewAnswered, { mode: "promiseExit" });
  const withdraw = useAtomSet(withdrawReviewReply, { mode: "promiseExit" });
  const [isActing, startActing] = useTransition();

  const params = { reviewId: review.id, workspaceId };
  const reactivityKeys = reviewsChanged(workspaceId, review.threadId);

  const failed = <A, E extends { readonly _tag: string }>(
    exit: Exit.Exit<A, E>
  ) => {
    toast.error(
      inboxErrorOf(exit).pipe(
        Option.map(explain),
        Option.getOrElse(() => explain({ key: "unknown" }))
      )
    );
  };

  const handleMark = () => {
    startActing(async () => {
      const exit = await mark({
        params,
        payload: { answered: !review.markedAnswered },
        reactivityKeys,
      });

      if (Exit.isFailure(exit)) {
        failed(exit);
      }
    });
  };

  const handleWithdraw = () => {
    startActing(async () => {
      const exit = await withdraw({ params, reactivityKeys });

      if (Exit.isSuccess(exit)) {
        toast.success(t("review.withdrawn"));

        return;
      }

      failed(exit);
    });
  };

  return (
    <>
      {mayAnswer ? (
        <>
          <Button variant="ghost" size="xs" onClick={onReply}>
            {t("review.answer")}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={isActing}
            focusableWhenDisabled
            onClick={handleMark}
          >
            {review.markedAnswered
              ? t("review.markWaiting")
              : t("review.markAnswered")}
          </Button>
        </>
      ) : null}
      {mayWithdraw && review.reply !== null ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                disabled={isActing}
                focusableWhenDisabled
              />
            }
          >
            {t("review.withdraw")}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("review.withdrawTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("review.withdrawDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("review.cancel")}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleWithdraw}>
                {t("review.withdraw")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
};

// The location's one composer: it answers `review`, under a key kept
// until the reply is made, and made anew for another text or review.
const ReviewComposer = ({
  inputId,
  onDraft,
  onSent,
  review,
  replies,
  workspaceId,
}: {
  readonly inputId: string;
  /** Keeps the draft on `review`, whatever the next read answers, until it is emptied. */
  readonly onDraft: (text: string) => void;
  /** Lets the composer move on to the next review waiting. */
  readonly onSent: () => void;
  readonly review: InboxReview;
  readonly replies: readonly InboxReviewReply[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxReviews");
  const explain = useInboxErrorText();
  const send = useAtomSet(replyToReview, { mode: "promiseExit" });
  const [text, setText] = useState("");

  const [attempt, setAttempt] = useState<ReplyAttempt>(() => ({
    key: crypto.randomUUID(),
    reviewId: review.id,
  }));

  // A failure tells of the review it was sent to only.
  const [failure, setFailure] = useState<{
    readonly reviewId: string;
    readonly text: string;
  } | null>(null);

  const [isSending, startSending] = useTransition();

  const handleSend = () => {
    // The same key until the reply is made: a reply sent again after a
    // lost answer is the one the first request made. Another review is
    // another reply, under a key of its own.
    const current = attemptFor(attempt, review.id, () => crypto.randomUUID());

    setAttempt(current);
    setFailure(null);
    startSending(async () => {
      const exit = await send({
        headers: { "idempotency-key": current.key },
        params: { reviewId: current.reviewId, workspaceId },
        payload: { text },
        reactivityKeys: reviewsChanged(workspaceId, review.threadId),
      });

      if (Exit.isSuccess(exit)) {
        setAttempt({ key: crypto.randomUUID(), reviewId: current.reviewId });
        setText("");
        onSent();
        toast.success(t("box.sent"));

        return;
      }

      setFailure({
        reviewId: current.reviewId,
        text: inboxErrorOf(exit).pipe(
          Option.map(explain),
          Option.getOrElse(() => explain({ key: "unknown" }))
        ),
      });
    });
  };

  return (
    <ReviewReplyBoxView
      bytes={bytesOf(text)}
      error={failure?.reviewId === review.id ? failure.text : null}
      inputId={inputId}
      maximum={maxInboxReviewReplyBytes}
      pending={isPending(replies, review.id)}
      reviewer={review.reviewerName}
      sending={isSending}
      text={text}
      onChange={(changed) => {
        // Another text is another reply, under a key of its own.
        setText(changed);
        setAttempt({ key: crypto.randomUUID(), reviewId: review.id });
        onDraft(changed);
      }}
      onSend={handleSend}
    />
  );
};

// The reviews once read.
const LoadedReviews = ({
  channels,
  detail,
  mayReply,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  readonly detail: InboxReviewThreadDetail;
  readonly mayReply: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxReviews");
  const listId = useId();
  const composerId = useId();
  // The review the composer answers, once a member chose one.
  const [chosen, setChosen] = useState<ComposerChoice | null>(null);
  const mayAnswer = mayReply && detail.abilities.reply === "available";

  const mayWithdraw = mayAnswer && detail.abilities.withdraw === "available";

  const target = reviewTargetOf(detail.reviews, chosen);

  const handleReply = (review: InboxReview) => {
    setChosen(replyChoice(review.id));
    // React's ids hold colons, which a plain `#id` selector cannot.
    globalThis.document
      .querySelector<HTMLTextAreaElement>(`[id="${composerId}"]`)
      ?.focus();
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <ReviewSummaryView
        channel={channels.find(({ id }) => id === detail.thread.channelId)}
        thread={detail.thread}
      />
      {mayReply ? null : (
        <p className="text-muted-foreground text-sm">{t("thread.readOnly")}</p>
      )}
      <section aria-labelledby={listId} className="flex flex-col gap-4">
        <h3 id={listId} className="sr-only">
          {t("thread.title")}
        </h3>
        {detail.reviews.length === 0 ? (
          <p className="text-muted-foreground">
            {t("thread.empty", { days: inboxReviewRetentionDays })}
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {detail.reviews.map((review) => (
              <ReviewView
                key={review.id}
                review={review}
                replies={detail.replies.filter(
                  ({ reviewId }) => reviewId === review.id
                )}
                {...(mayAnswer || mayWithdraw
                  ? {
                      actions: (
                        <ReviewActions
                          mayAnswer={mayAnswer}
                          mayWithdraw={mayWithdraw}
                          review={review}
                          workspaceId={workspaceId}
                          onReply={() => {
                            handleReply(review);
                          }}
                        />
                      ),
                    }
                  : {})}
              />
            ))}
          </ul>
        )}
      </section>
      {mayAnswer && target !== undefined ? (
        <div className="bg-card sticky bottom-0 mt-auto pt-2">
          <ReviewComposer
            inputId={composerId}
            replies={detail.replies}
            review={target}
            workspaceId={workspaceId}
            onDraft={(text) => {
              setChosen(choiceOnDraft(chosen, target.id, text));
            }}
            onSent={() => {
              setChosen(null);
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

/**
 * A location's reviews whole, as one conversation: a summary, each
 * review with the location's reply and the replies sent from Peal under
 * it, and, for a member who may answer and where the channel can, quiet
 * actions under each and one composer at the pane's foot. Rendered in the
 * browser, where the reader's time zone is known.
 */
export const ReviewScreen = ({
  mayReply,
  threadId,
  workspaceId,
}: {
  readonly mayReply: boolean;
  readonly threadId: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxReviews");
  const hydrated = useHydrated();
  const atom = reviewLocation(workspaceId, threadId);
  const result = useAtomValue(atom);
  const reload = useAtomRefresh(atom);
  const channels = useAtomValue(channelsOf(workspaceId));

  useRefreshWhileVisible(reload, refreshEvery);

  if (!hydrated || AsyncResult.isInitial(result)) {
    return <Skeleton className="h-48" />;
  }

  if (AsyncResult.isFailure(result)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t("loadFailed")}
            <Button variant="outline" size="sm" onClick={reload}>
              {t("retry")}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <LoadedReviews
      channels={
        AsyncResult.isSuccess(channels)
          ? channels.value.filter(isSocialChannel)
          : []
      }
      detail={result.value}
      mayReply={mayReply}
      workspaceId={workspaceId}
    />
  );
};
