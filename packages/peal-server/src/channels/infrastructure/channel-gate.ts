import { Entity } from "effect/cluster";
import { Rpc } from "effect/rpc";

import {
  AccountReadingSchema,
  AccountRequestSchema,
  MetricsBatchSchema,
  MetricsReadFailureSchema,
  MetricsRequestSchema,
} from "#analytics/application/metrics-reader.ts";
import {
  CommentsBatchSchema,
  CommentsReadFailureSchema,
  CommentsRequestSchema,
} from "#engagement/application/ports/comment-source.ts";
import {
  MessageSendOutcomeSchema,
  MessageSendRequestSchema,
} from "#engagement/application/ports/message-sender.ts";
import {
  MessagesBatchSchema,
  MessagesFollowOutcomeSchema,
  MessagesFollowRequestSchema,
  MessagesReadFailureSchema,
  MessagesRequestSchema,
} from "#engagement/application/ports/message-source.ts";
import {
  PrivateReplyOutcomeSchema,
  PrivateReplyRequestSchema,
} from "#engagement/application/ports/private-reply-sender.ts";
import {
  ActionOutcomeSchema,
  ModerationRequestSchema,
  SendOutcomeSchema,
  SendRequestSchema,
} from "#engagement/application/ports/reply-sender.ts";
import {
  ReviewActionOutcomeSchema,
  ReviewReplyCheckSchema,
  ReviewReplyRequestSchema,
  ReviewSendOutcomeSchema,
  ReviewWithdrawalSchema,
} from "#engagement/application/ports/review-reply-sender.ts";
import {
  ReviewsBatchSchema,
  ReviewsReadFailureSchema,
  ReviewsRequestSchema,
} from "#engagement/application/ports/review-source.ts";
import { FollowUpRequestSchema } from "#publishing/application/follow-up-publisher.ts";
import {
  EditOutcomeSchema,
  EditRequestSchema,
  RemovalFailureSchema,
  RemovalOutcomeSchema,
  RemovalRequestSchema,
} from "#publishing/application/live-post-clients.ts";
import { PublishRequestSchema } from "#publishing/application/platform-publisher.ts";
import { PublishFailureSchema } from "#shared/domain/publish-failure.ts";
import { PublishResultSchema } from "#shared/domain/publish-result.ts";

/**
 * One entity per channel (its id is the channel id), which makes every call
 * to the channel's platform account, one at a time: handlers run in turn, so
 * two posts due at once on one account go out one after the other, and a
 * later token refresh or rate-limit check never races a publish.
 *
 * Calls are volatile: nothing about them is stored in the cluster tables, so
 * post content never lands there. The job calling through the gate is
 * durable, and the publication journal covers a call cut short.
 *
 * A publish runs whole inside its gate: the media uploads, the wait while
 * the platform processes them, the token renewed on demand, the post and its
 * confirmation. `Resume` checks a call an earlier run left in flight.
 * `ReadMetrics` reads the counts of some of the channel's posts for
 * analytics, so reads take turns with publishing and share its rate limits;
 * each is bounded in time.
 * `ReadAccount` reads the account's own numbers the same way, once a day.
 * `ReadComments` reads the comments under some of its posts the same way,
 * and `SendReply`, `ResumeReply`, `WithdrawReply` and `ModerateComment` act
 * on them as the account, for engagement: their payloads are ids, and the
 * text of a reply stays in engagement's tables. `ReadReviews` reads a
 * location's reviews, and `SendReviewReply`, `ResumeReviewReply` and
 * `WithdrawReviewReply` answer them, the same way, and `ReadMessages`,
 * `SendMessage` and `ResumeMessage` read a channel's direct messages and
 * answer them, `SendPrivateReply` and `ResumePrivateReply` send the
 * author of a comment its one private reply, and `FollowMessages` and `UnfollowMessages` ask its
 * platform to tell the server of them, or to stop: their payloads are
 * ids, and no message's text travels through the cluster's tables. `RemoveLivePost` deletes a
 * post, or a part of one, that a member asked to unpublish, by the
 * platform's id for it: a removal never overlaps a publish on the channel.
 * `EditLivePost` replaces the text of a part a member asked to edit, by
 * the change's id and the platform's: the text never passes through the
 * gate, whose side reads it from the change.
 *
 * Calls run in the order they came, whichever context sent them. Each
 * collection (post counts, the account, comments, reviews, messages) has one call a channel
 * outstanding at most, so a publish waits for the reads that came before
 * it: one of each at most, each bounded, never for those after. Their
 * crons start on minutes of their own (`test/app/cron-schedules.test.ts`).
 */
export const ChannelGate = Entity.make("ChannelGate", [
  Rpc.make("Publish", {
    error: PublishFailureSchema,
    payload: { request: PublishRequestSchema },
    success: PublishResultSchema,
  }),
  Rpc.make("Resume", {
    error: PublishFailureSchema,
    payload: { request: PublishRequestSchema },
    success: PublishResultSchema,
  }),
  Rpc.make("ReadMetrics", {
    error: MetricsReadFailureSchema,
    payload: { request: MetricsRequestSchema },
    success: MetricsBatchSchema,
  }),
  Rpc.make("ReadAccount", {
    error: MetricsReadFailureSchema,
    payload: { request: AccountRequestSchema },
    success: AccountReadingSchema,
  }),
  Rpc.make("ReadComments", {
    error: CommentsReadFailureSchema,
    payload: { request: CommentsRequestSchema },
    success: CommentsBatchSchema,
  }),
  Rpc.make("SendReply", {
    payload: { request: SendRequestSchema },
    success: SendOutcomeSchema,
  }),
  Rpc.make("ResumeReply", {
    payload: { request: SendRequestSchema },
    success: SendOutcomeSchema,
  }),
  Rpc.make("WithdrawReply", {
    payload: { request: SendRequestSchema },
    success: ActionOutcomeSchema,
  }),
  Rpc.make("ModerateComment", {
    payload: { request: ModerationRequestSchema },
    success: ActionOutcomeSchema,
  }),
  Rpc.make("ReadReviews", {
    error: ReviewsReadFailureSchema,
    payload: { request: ReviewsRequestSchema },
    success: ReviewsBatchSchema,
  }),
  Rpc.make("SendReviewReply", {
    payload: { request: ReviewReplyRequestSchema },
    success: ReviewSendOutcomeSchema,
  }),
  Rpc.make("ResumeReviewReply", {
    payload: { request: ReviewReplyRequestSchema },
    success: ReviewSendOutcomeSchema,
  }),
  Rpc.make("CheckReviewReply", {
    payload: { request: ReviewReplyRequestSchema },
    success: ReviewReplyCheckSchema,
  }),
  Rpc.make("WithdrawReviewReply", {
    payload: { request: ReviewWithdrawalSchema },
    success: ReviewActionOutcomeSchema,
  }),
  Rpc.make("ReadMessages", {
    error: MessagesReadFailureSchema,
    payload: { request: MessagesRequestSchema },
    success: MessagesBatchSchema,
  }),
  Rpc.make("FollowMessages", {
    error: MessagesReadFailureSchema,
    payload: { request: MessagesFollowRequestSchema },
    success: MessagesFollowOutcomeSchema,
  }),
  Rpc.make("UnfollowMessages", {
    error: MessagesReadFailureSchema,
    payload: { request: MessagesFollowRequestSchema },
    success: MessagesFollowOutcomeSchema,
  }),
  Rpc.make("SendMessage", {
    payload: { request: MessageSendRequestSchema },
    success: MessageSendOutcomeSchema,
  }),
  Rpc.make("ResumeMessage", {
    payload: { request: MessageSendRequestSchema },
    success: MessageSendOutcomeSchema,
  }),
  Rpc.make("SendPrivateReply", {
    payload: { request: PrivateReplyRequestSchema },
    success: PrivateReplyOutcomeSchema,
  }),
  Rpc.make("ResumePrivateReply", {
    payload: { request: PrivateReplyRequestSchema },
    success: PrivateReplyOutcomeSchema,
  }),
  Rpc.make("RemoveLivePost", {
    error: RemovalFailureSchema,
    payload: { request: RemovalRequestSchema },
    success: RemovalOutcomeSchema,
  }),
  Rpc.make("EditLivePost", {
    error: RemovalFailureSchema,
    payload: { request: EditRequestSchema },
    success: EditOutcomeSchema,
  }),
  Rpc.make("SendFollowUp", {
    error: PublishFailureSchema,
    payload: { request: FollowUpRequestSchema },
    success: PublishResultSchema,
  }),
  Rpc.make("ResumeFollowUp", {
    error: PublishFailureSchema,
    payload: { request: FollowUpRequestSchema },
    success: PublishResultSchema,
  }),
]);
