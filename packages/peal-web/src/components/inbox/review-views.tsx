"use client";

import { DateTime } from "effect";
import { CheckIcon, StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { inboxReviewRetentionDays } from "peal-contract";
import type {
  InboxReview,
  InboxReviewReply,
  InboxReviewThread,
  SocialChannel,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Avatar, AvatarFallback } from "peal-ui/components/avatar";
import { Button } from "peal-ui/components/button";
import { Label } from "peal-ui/components/label";
import { Textarea } from "peal-ui/components/textarea";
import { useId } from "react";
import type { ChangeEvent, ReactNode, SubmitEvent } from "react";

import { initialOfName, useChannelName } from "./inbox-views.tsx";

// The views of the inbox's reviews: a location's summary, a review, its
// replies and the reply box, whatever fetched them. Their state lives in
// inbox-list.tsx and review-screen.tsx. A location reads as one
// conversation (DESIGN.md, "split-thread"): each review flat, the
// location's reply hanging under it, one composer at the pane's foot.
// What people wrote on Google is shown as text, never as markup: React
// escapes it.

const useInstant = () => {
  const format = useFormatter();

  return (at: DateTime.Utc) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "medium",
      timeStyle: "short",
    });
};

/**
 * A location's heading on its own page: which location, how many reviews
 * wait, what Google says of it as a whole, and how long Peal keeps a
 * review, which is why older ones are not there.
 */
export const ReviewSummaryView = ({
  channel,
  thread,
}: {
  /** The location's channel, unless it was disconnected since. */
  readonly channel: SocialChannel | undefined;
  readonly thread: InboxReviewThread;
}) => {
  const t = useTranslations("InboxReviews");
  const format = useFormatter();
  const channelName = useChannelName();
  const instant = useInstant();

  const figures = t("row.figures", {
    average:
      thread.averageRating === null
        ? "none"
        : format.number(thread.averageRating, { maximumFractionDigits: 1 }),
    total:
      thread.totalReviewCount === null
        ? "none"
        : format.number(thread.totalReviewCount),
  });

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <p className="text-sm">
        {t("row.location", { channel: channelName(channel) })}
      </p>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 tabular-nums">
          {thread.unanswered > 0 ? (
            <span aria-hidden className="bg-brand size-1.5 rounded-full" />
          ) : null}
          {t("row.counts", {
            reviews: thread.reviews,
            unanswered: thread.unanswered,
          })}
        </span>
        {figures === "" ? null : (
          <span className="tabular-nums">{figures}</span>
        )}
        {thread.lastReviewAt === null ? null : (
          <span>
            {t("row.lastReview", { at: instant(thread.lastReviewAt) })}
          </span>
        )}
      </p>
      <p className="text-muted-foreground text-xs">
        {t("thread.kept", { days: inboxReviewRetentionDays })}
      </p>
    </div>
  );
};

/** A reply sent from Peal to a review, and how it ended, in a muted line. */
export const ReviewReplyView = ({
  reply,
}: {
  readonly reply: InboxReviewReply;
}) => {
  const t = useTranslations("InboxReviews.review");
  const troubled = reply.status === "failed" || reply.status === "unconfirmed";

  return (
    <p
      className={
        troubled
          ? "text-destructive text-xs font-medium"
          : "text-muted-foreground text-xs"
      }
    >
      {t("reply", { status: reply.status })}
    </p>
  );
};

// Where a review stands, in its meta line: the brand's dot while it
// waits, as its location's row has, and a check once answered.
const ReviewState = ({ state }: { readonly state: InboxReview["state"] }) => {
  const t = useTranslations("InboxReviews.review");

  return (
    <span className="flex items-center gap-1">
      {state === "new" ? (
        <span aria-hidden className="bg-brand size-1.5 rounded-full" />
      ) : (
        <CheckIcon aria-hidden className="size-3" />
      )}
      {t("state", { state })}
    </span>
  );
};

/**
 * One review, flat: its author's avatar and name (as they show
 * themselves), a muted line with its stars, when it was written or
 * changed, where it stands and how many photos it holds (never the
 * photos), its text, what a member may do about it (`actions`, Reply
 * first), and, behind a line at its start, the location's reply with
 * Google's moderation and the replies sent from Peal.
 */
export const ReviewView = ({
  actions,
  replies,
  review,
}: {
  /** What the member may do, already wired; none when they only read. */
  readonly actions?: ReactNode;
  readonly replies: readonly InboxReviewReply[];
  readonly review: InboxReview;
}) => {
  const t = useTranslations("InboxReviews.review");
  const instant = useInstant();
  const name = review.reviewerName ?? t("anonymous");

  const changed =
    DateTime.toEpochMillis(review.updatedAt) !==
    DateTime.toEpochMillis(review.writtenAt);

  return (
    <li className="flex gap-3">
      <Avatar size="sm">
        <AvatarFallback>
          {review.reviewerName === null
            ? "?"
            : initialOfName(review.reviewerName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <bdi className="font-medium break-words">{name}</bdi>
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span className="flex items-center gap-1 tabular-nums">
              <StarIcon aria-hidden className="size-3" />
              {t("stars", { rating: review.rating })}
            </span>
            <span aria-hidden>·</span>
            <span>
              {changed
                ? t("changed", { at: instant(review.updatedAt) })
                : t("written", { at: instant(review.writtenAt) })}
            </span>
            <span aria-hidden>·</span>
            <ReviewState state={review.state} />
            {review.photos > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>{t("photos", { count: review.photos })}</span>
              </>
            ) : null}
          </span>
        </div>
        <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
          {review.text === "" ? t("noText") : review.text}
        </p>
        {actions === undefined || actions === null ? null : (
          <div className="-ml-2 flex flex-wrap items-center gap-1 empty:hidden">
            {actions}
          </div>
        )}
        {review.reply === null && replies.length === 0 ? null : (
          <div className="mt-2 flex flex-col gap-2 border-l-2 pl-3">
            {review.reply === null ? null : (
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="text-foreground font-medium">
                    {t("ownerReply")}
                  </span>
                  {review.reply.moderation === null ? null : (
                    <>
                      <span aria-hidden>·</span>
                      <span
                        className={
                          review.reply.moderation === "rejected"
                            ? "text-destructive font-medium"
                            : undefined
                        }
                      >
                        {t("moderation", {
                          moderation: review.reply.moderation,
                        })}
                      </span>
                    </>
                  )}
                </p>
                <p
                  dir="auto"
                  className="text-sm break-words whitespace-pre-wrap"
                >
                  {review.reply.text}
                </p>
              </div>
            )}
            {replies.map((reply) => (
              <ReviewReplyView key={reply.id} reply={reply} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

/**
 * The location's one composer, at the pane's foot: it answers the review
 * Reply chose and names whom (`reviewer`, null for someone anonymous),
 * counted in Google's bytes.
 */
export const ReviewReplyBoxView = ({
  bytes,
  error,
  inputId,
  maximum,
  onChange,
  onSend,
  pending,
  reviewer,
  sending,
  text,
}: {
  /** How long the text is, in UTF-8 bytes. */
  readonly bytes: number;
  /** Why the last send failed, already written. */
  readonly error: string | null;
  /** The text field's id, so a review's Reply can focus it. */
  readonly inputId?: string;
  readonly maximum: number;
  readonly onChange: (text: string) => void;
  readonly onSend: () => void;
  /** Whether a reply to the review is on its way. */
  readonly pending: boolean;
  /** Who wrote the review answered; null when they stay anonymous. */
  readonly reviewer: string | null;
  readonly sending: boolean;
  readonly text: string;
}) => {
  const t = useTranslations("InboxReviews.box");
  const ownId = useId();
  const id = inputId ?? ownId;
  const hintId = useId();
  const countId = useId();
  const tooLong = bytes > maximum;
  const empty = text.trim() === "";

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm"
    >
      <Label htmlFor={id}>
        {reviewer === null ? t("labelAnonymous") : t("label", { reviewer })}
      </Label>
      <Textarea
        dir="auto"
        id={id}
        value={text}
        disabled={pending || sending}
        aria-invalid={tooLong}
        aria-describedby={`${hintId} ${countId}`}
        onChange={handleChange}
      />
      <span id={hintId} className="text-muted-foreground text-xs">
        {t("public")}
      </span>
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {pending ? <output className="text-sm">{t("pending")}</output> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={countId}
          aria-live="polite"
          className={
            tooLong
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {t("count", { length: bytes, maximum })}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={pending || sending || empty || tooLong}
          focusableWhenDisabled
        >
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
};
