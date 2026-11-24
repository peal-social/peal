import { Duration, Effect, Layer } from "effect";

import { MetricsReader } from "#analytics/application/metrics-reader.ts";
import { ChannelGate } from "#channels/infrastructure/channel-gate.ts";
import { CommentSource } from "#engagement/application/ports/comment-source.ts";
import { MessageSender } from "#engagement/application/ports/message-sender.ts";
import { MessageSource } from "#engagement/application/ports/message-source.ts";
import { PrivateReplySender } from "#engagement/application/ports/private-reply-sender.ts";
import { ReplySender } from "#engagement/application/ports/reply-sender.ts";
import { ReviewReplySender } from "#engagement/application/ports/review-reply-sender.ts";
import { ReviewSource } from "#engagement/application/ports/review-source.ts";
import { FollowUpPublisher } from "#publishing/application/follow-up-publisher.ts";
import { LivePostClients } from "#publishing/application/live-post-clients.ts";
import { PlatformPublisher } from "#publishing/application/platform-publisher.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";

/**
 * Runs the gate with the platform adapters it is given: the publishers, and
 * analytics' readers. A bug in an adapter fails its own call instead of
 * restarting the entity, which would replay the call in flight.
 */
export const ChannelGateLive = ChannelGate.toLayer(
  Effect.gen(function* ChannelGateLive() {
    const platforms = yield* PlatformPublisher;
    const metrics = yield* MetricsReader;
    const comments = yield* CommentSource;
    const replies = yield* ReplySender;
    const reviews = yield* ReviewSource;
    const reviewReplies = yield* ReviewReplySender;
    const messages = yield* MessageSource;
    const messageSender = yield* MessageSender;
    const privateReplies = yield* PrivateReplySender;
    const live = yield* LivePostClients;
    const followUps = yield* FollowUpPublisher;

    return ChannelGate.of({
      EditLivePost: ({ payload }) => live.edit(payload.request),
      FollowMessages: ({ payload }) => messages.follow(payload.request),
      UnfollowMessages: ({ payload }) => messages.unfollow(payload.request),
      ModerateComment: ({ payload }) => replies.moderate(payload.request),
      Publish: ({ payload }) => platforms.publish(payload.request),
      ReadAccount: ({ payload }) => metrics.account(payload.request),
      ReadComments: ({ payload }) => comments.read(payload.request),
      ReadMessages: ({ payload }) => messages.read(payload.request),
      ReadMetrics: ({ payload }) => metrics.read(payload.request),
      CheckReviewReply: ({ payload }) => reviewReplies.check(payload.request),
      ReadReviews: ({ payload }) => reviews.read(payload.request),
      RemoveLivePost: ({ payload }) => live.remove(payload.request),
      Resume: ({ payload }) => platforms.resume(payload.request),
      ResumeFollowUp: ({ payload }) => followUps.resume(payload.request),
      ResumeMessage: ({ payload }) => messageSender.resume(payload.request),
      ResumePrivateReply: ({ payload }) =>
        privateReplies.resume(payload.request),
      ResumeReply: ({ payload }) => replies.resume(payload.request),
      ResumeReviewReply: ({ payload }) => reviewReplies.resume(payload.request),
      SendFollowUp: ({ payload }) => followUps.send(payload.request),
      SendMessage: ({ payload }) => messageSender.send(payload.request),
      SendPrivateReply: ({ payload }) => privateReplies.send(payload.request),
      SendReply: ({ payload }) => replies.send(payload.request),
      SendReviewReply: ({ payload }) => reviewReplies.send(payload.request),
      WithdrawReply: ({ payload }) => replies.withdraw(payload.request),
      WithdrawReviewReply: ({ payload }) =>
        reviewReplies.withdraw(payload.request),
    });
  }),
  { disableFatalDefects: true, maxIdleTime: Duration.minutes(10) }
);

/**
 * For gates that publish only, as in tests of publishing: every read
 * answers that the platform is unavailable, and reads nothing.
 */
export const UnreadMetrics = Layer.succeed(
  MetricsReader,
  MetricsReader.of({
    account: () => Effect.fail(new PlatformUnavailable()),
    read: () => Effect.fail(new PlatformUnavailable()),
  })
);

/** For gates that read no review and answer none: as UnreadComments. */
export const UnreadReviews = Layer.mergeAll(
  Layer.succeed(
    ReviewSource,
    ReviewSource.of({ read: () => Effect.fail(new PlatformUnavailable()) })
  ),
  Layer.succeed(
    ReviewReplySender,
    ReviewReplySender.of({
      check: () => Effect.succeed({ _tag: "unknown" }),
      resume: () =>
        Effect.succeed({ _tag: "unconfirmed", reason: "interrupted" }),
      send: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
      withdraw: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
    })
  )
);

/**
 * For gates that read no direct message and send none, nor a private
 * reply: as UnreadComments.
 */
export const UnreadMessages = Layer.mergeAll(
  Layer.succeed(
    MessageSource,
    MessageSource.of({
      follow: () => Effect.fail(new PlatformUnavailable()),
      read: () => Effect.fail(new PlatformUnavailable()),
      unfollow: () => Effect.fail(new PlatformUnavailable()),
    })
  ),
  Layer.succeed(
    MessageSender,
    MessageSender.of({
      resume: () =>
        Effect.succeed({ _tag: "unconfirmed", reason: "interrupted" }),
      send: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
    })
  ),
  Layer.succeed(
    PrivateReplySender,
    PrivateReplySender.of({
      resume: () =>
        Effect.succeed({ _tag: "unconfirmed", reason: "interrupted" }),
      send: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
    })
  )
);

/**
 * For gates that neither read comments, reviews and messages nor answer
 * them, as in tests of publishing: every read answers that the platform
 * is unavailable, and nothing is sent.
 */
export const UnreadComments = Layer.mergeAll(
  UnreadReviews,
  UnreadMessages,
  Layer.succeed(
    CommentSource,
    CommentSource.of({ read: () => Effect.fail(new PlatformUnavailable()) })
  ),
  Layer.succeed(
    ReplySender,
    ReplySender.of({
      moderate: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
      resume: () =>
        Effect.succeed({ _tag: "unconfirmed", reason: "interrupted" }),
      send: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
      withdraw: () =>
        Effect.succeed({ _tag: "failed", reason: "platformUnavailable" }),
    })
  )
);
