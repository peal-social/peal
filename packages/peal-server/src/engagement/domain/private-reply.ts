import { DateTime, Duration, Option, Result, Schema } from "effect";

import {
  ChannelIdSchema,
  UserIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import type { UserId } from "#shared/domain/ids.ts";

import { CommentIdSchema } from "./comment-id.ts";
import { CommentRuleIdSchema } from "./comment-rule-id.ts";
import type { CommentRuleId } from "./comment-rule-id.ts";
import { isOnPlatform } from "./comment.ts";
import type { Comment } from "./comment.ts";
import { PlatformMessageIdSchema } from "./direct-message.ts";
import { InvalidPrivateReplyTransition } from "./invalid-private-reply-transition.ts";
import { PrivateReplyIdSchema } from "./private-reply-id.ts";
import type { PrivateReplyId } from "./private-reply-id.ts";
import { ReplyDoubtSchema } from "./reply.ts";
import { ThreadIdSchema } from "./thread-id.ts";

/**
 * Why a private reply did not go out. Each means the person received
 * nothing:
 *
 * - `channelUnavailable`: the channel was disconnected, turned off, or its
 *   messages were turned off.
 * - `reconnectNeeded`: the platform refuses the channel's token.
 * - `rateLimited`: the platform asked the account to slow down.
 * - `platformUnavailable`: the platform did not answer, or failed.
 * - `commentGone`: the platform no longer takes the comment for a
 *   private reply (deleted, or not one it allows).
 * - `alreadyAnswered`: the platform says the comment had its one private
 *   reply already, sent from somewhere other than this request.
 * - `refused`: the platform refused it: the person takes no message from
 *   the account, the Page's messages are off, or the app may not write to
 *   them yet.
 * - `windowClosed`: the platform's seven days had passed.
 * - `notSent`: its outcome was unknown, and a member found it never went
 *   out.
 *
 * Stored and published: add a member, never rename or remove one.
 */
export const PrivateReplyFailureSchema = Schema.Literals([
  "channelUnavailable",
  "reconnectNeeded",
  "rateLimited",
  "platformUnavailable",
  "commentGone",
  "alreadyAnswered",
  "refused",
  "windowClosed",
  "notSent",
]);

export type PrivateReplyFailure = typeof PrivateReplyFailureSchema.Type;

/** How sending a private reply ended, as the platform's adapter tells it. */
export const PrivateReplyOutcomeSchema = Schema.Union([
  Schema.TaggedStruct("sent", { platformMessageId: PlatformMessageIdSchema }),
  Schema.TaggedStruct("failed", { reason: PrivateReplyFailureSchema }),
  Schema.TaggedStruct("unconfirmed", { reason: ReplyDoubtSchema }),
]);

export type PrivateReplyOutcome = typeof PrivateReplyOutcomeSchema.Type;

export const PrivateReplyStatusSchema = Schema.Union([
  // Journalled, and on its way. `attemptedAt` is when a run first set out
  // to call the platform: from then on the call may have left, so a later
  // run looks the message up instead of sending it.
  Schema.TaggedStruct("sending", {
    attemptedAt: Schema.Option(Schema.DateTimeUtc),
  }),
  Schema.TaggedStruct("sent", {
    at: Schema.DateTimeUtc,
    // None when a member confirmed by hand a reply Peal could not find.
    platformMessageId: Schema.Option(PlatformMessageIdSchema),
  }),
  Schema.TaggedStruct("failed", {
    at: Schema.DateTimeUtc,
    reason: PrivateReplyFailureSchema,
  }),
  // It may have reached the person: never sent again, a member checks.
  Schema.TaggedStruct("unconfirmed", {
    at: Schema.DateTimeUtc,
    reason: ReplyDoubtSchema,
  }),
]);

export type PrivateReplyStatus = typeof PrivateReplyStatusSchema.Type;

/**
 * The one private message the channel's account sends the author of a
 * comment under one of its posts, on Instagram or a Facebook Page, in
 * answer to that comment (Meta's private replies). It answers a comment,
 * not a conversation: Peal may hold none with that person, and makes none
 * up; their answer, if any, comes as a direct message. It is journalled
 * before the platform is called, and sent once: one a comment while it is
 * on its way, unconfirmed or sent, and one whose outcome is unknown is
 * looked up, never sent again. It goes with its comment.
 */
export class PrivateReply extends Schema.Class<PrivateReply>(
  "peal-server/engagement/domain/PrivateReply"
)({
  // The member who wrote it; none for an API key, or once they closed
  // their account.
  authorId: Schema.Option(UserIdSchema),
  channelId: ChannelIdSchema,
  commentId: CommentIdSchema,
  createdAt: Schema.DateTimeUtc,
  id: PrivateReplyIdSchema,
  // The comment rule that sent it; none for a member's own.
  ruleId: Schema.Option(CommentRuleIdSchema),
  status: PrivateReplyStatusSchema,
  text: Schema.NonEmptyString,
  threadId: ThreadIdSchema,
  workspaceId: WorkspaceIdSchema,
}) {}

/**
 * How long after a comment was written Peal offers a private reply:
 * Meta's seven days ("The message must be sent within 7 days from when
 * the post or comment was created", developers.facebook.com/documentation/
 * business-messaging/messenger-platform/discovery/private-replies, and
 * Instagram's twin page, read 2026-11-16), less an hour, so a reply Peal
 * lets through is never refused for a clock's difference.
 */
export const privateReplyWindow = Duration.subtract(
  Duration.days(7),
  Duration.hours(1)
);

/** How long an idempotency key names the private reply it made. */
export const privateReplyKeyLifetime = Duration.hours(24);

/** When Peal stops offering a private reply to the comment. */
export const privateReplyUntil = (
  comment: Pick<Comment, "writtenAt">
): DateTime.Utc => DateTime.addDuration(comment.writtenAt, privateReplyWindow);

/**
 * Why a comment cannot get a private reply: the account's own comment,
 * one the platform no longer shows, or one written before the window.
 */
export const PrivateReplyRefusalSchema = Schema.Literals([
  "ownComment",
  "gone",
  "tooOld",
]);

export type PrivateReplyRefusal = typeof PrivateReplyRefusalSchema.Type;

/**
 * Whether the comment may get a private reply at `now`: someone else's
 * than the account's (`accountId`, its id on the platform, when known),
 * still shown on the platform, and written within `privateReplyWindow`,
 * counted from when its author wrote it, never when Peal read it.
 */
export const mayReplyPrivately = (
  comment: Comment,
  now: DateTime.Utc,
  accountId: Option.Option<string>
): Result.Result<Comment, PrivateReplyRefusal> => {
  if (!isOnPlatform(comment) || Option.isSome(comment.expiredAt)) {
    return Result.fail("gone");
  }

  if (
    Option.isSome(accountId) &&
    Option.exists(
      comment.author,
      ({ platformId }) => platformId === accountId.value
    )
  ) {
    return Result.fail("ownComment");
  }

  return DateTime.isLessThan(now, privateReplyUntil(comment))
    ? Result.succeed(comment)
    : Result.fail("tooOld");
};

type Transition = Result.Result<PrivateReply, InvalidPrivateReplyTransition>;

type Fields = ConstructorParameters<typeof PrivateReply>[0];

const withFields = (
  reply: PrivateReply,
  changed: Partial<Fields>
): PrivateReply =>
  new PrivateReply({
    authorId: reply.authorId,
    channelId: reply.channelId,
    commentId: reply.commentId,
    createdAt: reply.createdAt,
    id: reply.id,
    ruleId: reply.ruleId,
    status: reply.status,
    text: reply.text,
    threadId: reply.threadId,
    workspaceId: reply.workspaceId,
    ...changed,
  });

const refused = (reply: PrivateReply): Transition =>
  Result.fail(
    new InvalidPrivateReplyTransition({
      from: reply.status._tag,
      privateReplyId: reply.id,
    })
  );

/** A private reply to the comment, about to be journalled and sent. */
export const writePrivateReply = (
  id: PrivateReplyId,
  comment: Pick<Comment, "channelId" | "id" | "threadId" | "workspaceId">,
  authorId: Option.Option<UserId>,
  text: string,
  ruleId: Option.Option<CommentRuleId>,
  now: DateTime.Utc
): PrivateReply =>
  new PrivateReply({
    authorId,
    channelId: comment.channelId,
    commentId: comment.id,
    createdAt: now,
    id,
    ruleId,
    status: { _tag: "sending", attemptedAt: Option.none() },
    text,
    threadId: comment.threadId,
    workspaceId: comment.workspaceId,
  });

/**
 * The private reply as a run sets out to call the platform, recorded
 * before the call. Refused when it is no longer on its way.
 */
export const beginPrivateReply = (
  reply: PrivateReply,
  now: DateTime.Utc
): Transition =>
  reply.status._tag === "sending"
    ? Result.succeed(
        withFields(reply, {
          status: {
            _tag: "sending",
            attemptedAt: Option.orElse(reply.status.attemptedAt, () =>
              Option.some(now)
            ),
          },
        })
      )
    : refused(reply);

/**
 * Whether an earlier run may already have called the platform for this
 * private reply: it is then looked up, never sent again.
 */
export const privateReplyAttempted = (reply: PrivateReply): boolean =>
  reply.status._tag === "sending" && Option.isSome(reply.status.attemptedAt);

/** Records how sending ended. Only a private reply on its way can end. */
export const settlePrivateReply = (
  reply: PrivateReply,
  outcome: PrivateReplyOutcome,
  now: DateTime.Utc
): Transition => {
  if (reply.status._tag !== "sending") {
    return refused(reply);
  }

  switch (outcome._tag) {
    case "sent": {
      return Result.succeed(
        withFields(reply, {
          status: {
            _tag: "sent",
            at: now,
            platformMessageId: Option.some(outcome.platformMessageId),
          },
        })
      );
    }

    case "failed": {
      return Result.succeed(
        withFields(reply, {
          status: { _tag: "failed", at: now, reason: outcome.reason },
        })
      );
    }

    case "unconfirmed": {
      return Result.succeed(
        withFields(reply, {
          status: { _tag: "unconfirmed", at: now, reason: outcome.reason },
        })
      );
    }

    default: {
      return outcome satisfies never;
    }
  }
};

/**
 * Records what a member found for a private reply Peal could not confirm:
 * the person received it, or it never went out.
 */
export const confirmPrivateReply = (
  reply: PrivateReply,
  went: boolean,
  now: DateTime.Utc
): Transition =>
  reply.status._tag === "unconfirmed"
    ? Result.succeed(
        withFields(reply, {
          status: went
            ? { _tag: "sent", at: now, platformMessageId: Option.none() }
            : { _tag: "failed", at: now, reason: "notSent" },
        })
      )
    : refused(reply);

/** The private reply without its author, once their account is closed. */
export const forgetPrivateReplyAuthor = (reply: PrivateReply): PrivateReply =>
  withFields(reply, { authorId: Option.none() });
