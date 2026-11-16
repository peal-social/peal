import { DateTime, Effect, Option, Schema } from "effect";
import {
  CurrentMember,
  defaultInboxPageSize,
  privateReplyWindowDays,
} from "peal-contract";

import { InboxTools } from "#app/mcp/inbox-tools.ts";
import {
  messagesConsentText,
  notAllowed,
  refuse,
  usageRefusal,
} from "#app/mcp/refusals.ts";
import { commentRuleView } from "#engagement/api/comment-rule-view.ts";
import {
  conversationCursorOf,
  messageCursorOf,
  toConversationDetailView,
  toConversationPageView,
  toOutgoingMessageView,
} from "#engagement/api/inbox-message-view.ts";
import {
  reviewCursorOf,
  toReviewReplyView,
  toReviewThreadDetailView,
  toReviewThreadPageView,
  toReviewView,
} from "#engagement/api/inbox-review-view.ts";
import {
  cursorOf,
  toCommentView,
  toPrivateReplyView,
  toReplyView,
  toThreadDetailView,
  toThreadPageView,
} from "#engagement/api/inbox-view.ts";
import type { AbilityUnavailable } from "#engagement/application/ability-unavailable.ts";
import type { CommentRuleNotPossible } from "#engagement/application/comment-rule-not-possible.ts";
import { CommentRules } from "#engagement/application/comment-rules.ts";
import type {
  ChangeCommentRuleRequest,
  StartCommentRuleRequest,
  ListedCommentRule,
} from "#engagement/application/comment-rules.ts";
import { EngagementInbox } from "#engagement/application/engagement-inbox.ts";
import {
  EngagementMessages,
  maxMessagesPerPage,
} from "#engagement/application/engagement-messages.ts";
import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import { EngagementReplies } from "#engagement/application/engagement-replies.ts";
import { EngagementReviews } from "#engagement/application/engagement-reviews.ts";
import type { MessageAbilityUnavailable } from "#engagement/application/message-ability-unavailable.ts";
import type { ModerationFailed } from "#engagement/application/moderation-failed.ts";
import type { ReplyTooLong } from "#engagement/application/reply-too-long.ts";
import type { ReviewActionFailed } from "#engagement/application/review-action-failed.ts";
import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { CommentRuleIdSchema } from "#engagement/domain/comment-rule-id.ts";
import type { CommentRuleScope } from "#engagement/domain/comment-rule.ts";
import type { Comment } from "#engagement/domain/comment.ts";
import { ConversationIdSchema } from "#engagement/domain/conversation-id.ts";
import type { InvalidReplyTransition } from "#engagement/domain/invalid-reply-transition.ts";
import { ReplyIdSchema } from "#engagement/domain/reply-id.ts";
import { ReviewIdSchema } from "#engagement/domain/review-id.ts";
import { ReviewThreadIdSchema } from "#engagement/domain/review-thread-id.ts";
import { ThreadIdSchema } from "#engagement/domain/thread-id.ts";
import { actorOf } from "#shared/api/actor.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { ChannelIdSchema, PostIdSchema } from "#shared/domain/ids.ts";

const decodeThreadId = Schema.decodeUnknownOption(ThreadIdSchema);
const decodeCommentId = Schema.decodeUnknownOption(CommentIdSchema);
const decodeReplyId = Schema.decodeUnknownOption(ReplyIdSchema);
const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);
const decodePostId = Schema.decodeUnknownOption(PostIdSchema);
const decodeReviewThreadId = Schema.decodeUnknownOption(ReviewThreadIdSchema);
const decodeReviewId = Schema.decodeUnknownOption(ReviewIdSchema);
const decodeConversationId = Schema.decodeUnknownOption(ConversationIdSchema);

const noConversation = () =>
  refuse(
    "The workspace has no such conversation: it may have gone with its channel, or be older than Peal keeps one. list_conversations lists them."
  );

const cannotMessage = ({
  closedAt,
  reason,
  standing,
}: MessageAbilityUnavailable) => {
  if (reason === "windowClosed" && closedAt !== undefined) {
    return refuse(
      `Nothing was sent: the platform takes no answer to this conversation since ${DateTime.formatIso(closedAt)}, as Messenger and Instagram take one only within 24 hours of the person's last message. Do not call this tool again for it; the user may answer from the platform's own inbox if its rules allow.`
    );
  }

  return refuse(
    standing === "reconnect"
      ? "This channel may not send direct messages yet: its account was connected before Peal asked for what that takes, or the channel was disconnected or turned off. The user disconnects it and connects the account again, in the web app. Nothing was sent."
      : "Nothing was sent: this server does not send direct messages on this channel's platform, or nobody else wrote in the conversation yet, and Peal never starts one."
  );
};

// Why a comment gets no private reply, in words.
const privateReplyRefusals = {
  gone: "The comment is no longer on its platform: nothing was sent.",
  ownComment:
    "The channel's own account wrote this comment: a private reply goes to someone else's. Nothing was sent.",
  tooOld: `The comment was written more than ${String(privateReplyWindowDays)} days ago, less Peal's hour: the platform takes no private reply to it any more. Nothing was sent.`,
} as const;

const noLocation = () =>
  refuse(
    "The workspace has no such location's reviews: list_location_reviews lists them."
  );

const noReview = () =>
  refuse(
    "The workspace has no such review: it may have gone from Google, or be older than Peal keeps one. get_location_reviews shows a location's."
  );

// Only a member in the web app answers a review, or deletes its reply.
const reviewNeedsPerson = () =>
  refuse(
    "Only the user, signed in to Peal in the web app, answers a review or deletes its reply: Google's policies ask that a reply to a review follow the user's own decision, never an application's. Nothing was sent. Reading the reviews and marking one answered stay open to this connection."
  );

const notDoneOnGoogle = ({ reason }: ReviewActionFailed) =>
  refuse(
    `Google did not do it (${reason}), and nothing changed in Peal: asking again is safe.`
  );

const noThread = () =>
  refuse("The workspace has no such thread: list_comment_threads lists them.");

const noComment = () =>
  refuse(
    "The workspace has no such comment: get_comment_thread shows a thread's."
  );

const noReply = () =>
  refuse(
    "The workspace has no such reply: get_comment_thread shows a thread's."
  );

const gone = () =>
  refuse(
    "The comment is no longer on its platform: it can be neither answered nor moderated."
  );

const unavailable = ({ ability, standing }: AbilityUnavailable) =>
  refuse(
    standing === "reconnect"
      ? `This channel may not ${ability} yet: its account was connected before Peal asked for what that takes, or the channel was disconnected or turned off. The user disconnects it and connects the account again, in the web app. Nothing was asked of the platform.`
      : `This channel's platform does not let the account ${ability} here: nothing was asked of it.`
  );

const failed = ({ reason }: ModerationFailed) =>
  refuse(
    `The platform did not do it (${reason}), and nothing changed in Peal: asking again is safe.`
  );

const conflict = ({ from }: InvalidReplyTransition) =>
  refuse(
    `The reply is ${from}, which does not allow this: only an unconfirmed reply is confirmed, and only a sent one is withdrawn.`
  );

const tooLong = ({ length, maximum, unit }: ReplyTooLong) =>
  refuse(
    `The reply is too long for its platform: ${String(length)} ${unit}, where it takes ${String(maximum)} (on Mastodon, the mention of the person answered counts). Nothing was sent.`
  );

const idOr = <A>(
  found: Option.Option<A>,
  missing: () => ReturnType<typeof refuse>
) => Option.match(found, { onNone: missing, onSome: Effect.succeed });

// A filter that names nothing lists nothing: said, rather than answered
// with every thread.
const filterOf = <A>(
  text: string | undefined,
  decode: (value: string) => Option.Option<A>,
  name: string
) => {
  if (text === undefined) {
    return Effect.succeed(Option.none<A>());
  }

  return Option.match(decode(text), {
    onNone: () => refuse(`${name} is not one this server gave.`),
    onSome: (id) => Effect.succeed(Option.some(id)),
  });
};

const decodeCommentRuleId = Schema.decodeUnknownOption(CommentRuleIdSchema);
const decodeRuleChannel = Schema.decodeUnknownOption(ChannelIdSchema);
const decodeRulePost = Schema.decodeUnknownOption(PostIdSchema);

const noCommentRule = () =>
  refuse(
    "The workspace has no comment rule with this id: list_comment_rules answers its rules."
  );

const ruleRefusal = ({ channels, reason }: CommentRuleNotPossible) => {
  if (channels.length === 0) {
    return `The rule cannot answer (${reason}): it needs 1 to 10 keywords, a reply, a private reply that says something if it has one, and a post that went out or a channel the inbox reads.`;
  }

  return reason === "privateReply"
    ? `No channel that answers can carry the rule's private reply (\`privateReply\` of each channel: \`messagesOff\` means the channel's direct messages are off), or it is too long for one that could. Nothing was saved. Each channel: ${JSON.stringify(channels)}`
    : `No channel can carry the rule's reply, or it is too long for one that could. Nothing was saved. Each channel: ${JSON.stringify(channels)}`;
};

const ruleNotPossible = (refusal: CommentRuleNotPossible) =>
  refuse(ruleRefusal(refusal));

// What a call answers on: one post or one channel.
const ruleScopeFrom = (given: {
  readonly channelId?: string;
  readonly postId?: string;
}) =>
  Effect.gen(function* readingScope() {
    if ((given.postId === undefined) === (given.channelId === undefined)) {
      return yield* refuse(
        "Give postId or channelId, one of them: whose comments the rule answers."
      );
    }

    if (given.postId !== undefined) {
      const postId = decodeRulePost(given.postId);

      if (Option.isNone(postId)) {
        return yield* refuse("The workspace has no post with this id.");
      }

      const scope: CommentRuleScope = { _tag: "post", postId: postId.value };

      return scope;
    }

    const channelId = decodeRuleChannel(given.channelId);

    if (Option.isNone(channelId)) {
      return yield* refuse("The workspace has no channel with this id.");
    }

    const scope: CommentRuleScope = {
      _tag: "channel",
      channelId: channelId.value,
    };

    return scope;
  });

const ruleIdFrom = (raw: string) =>
  Option.match(decodeCommentRuleId(raw), {
    onNone: noCommentRule,
    onSome: (id) => Effect.succeed(id),
  });

/** What the inbox tools do, through the engagement use cases. */
export const InboxToolsLive = InboxTools.toLayer(
  Effect.gen(function* inboxTools() {
    const inbox = yield* EngagementInbox;
    const replies = yield* EngagementReplies;
    const reviews = yield* EngagementReviews;
    const commentRules = yield* CommentRules;
    const messages = yield* EngagementMessages;
    const privateReplies = yield* EngagementPrivateReplies;
    const refusedByMeter = yield* usageRefusal;

    const actor = CurrentMember.pipe(Effect.map(actorOf));

    // A comment as the member sees it, with its private reply.
    const commentView = (member: Actor, comment: Comment) =>
      privateReplies
        .ofThread(member, comment.channelId, [comment.id])
        .pipe(Effect.map((shown) => toCommentView(comment, new Map(), shown)));

    // Without the owner's leave, an application lists conversations only:
    // the refusal names its client id, which the owner allows.
    const notAllowedToRead = () =>
      actor.pipe(
        Effect.flatMap(({ subject }) =>
          refuse(
            messagesConsentText(
              subject._tag === "user" ? (subject.clientId ?? "") : ""
            )
          )
        )
      );

    // Said before anything is read: a rule answers in public.
    const answerer = actor.pipe(
      Effect.tap((member) =>
        Effect.fromResult(authorize(member, "engagement:reply")).pipe(
          Effect.catchTag("MissingPermission", notAllowed("answer comments"))
        )
      )
    );

    return InboxTools.of({
      list_comment_rules: ({ status }) =>
        Effect.gen(function* list() {
          const member = yield* actor;
          const found: ListedCommentRule[] = [];

          // Every page: a workspace keeps few rules.
          for (;;) {
            const page = yield* commentRules
              .list(member, {
                after: Option.fromUndefinedOr(found.at(-1)?.rule.id),
                limit: 100,
                status: Option.fromUndefinedOr(status),
              })
              .pipe(
                Effect.catchTags({
                  DatabaseError: Effect.die,
                  MissingPermission: notAllowed("read comment rules"),
                })
              );

            found.push(...page);

            if (page.length < 100) {
              return { rules: found.map(commentRuleView) };
            }
          }
        }),
      start_comment_rule: (given) =>
        Effect.gen(function* start() {
          const member = yield* answerer;
          const scope = yield* ruleScopeFrom(given);

          const request: StartCommentRuleRequest =
            given.privateReply === undefined
              ? { keywords: given.keywords, reply: given.reply, scope }
              : {
                  keywords: given.keywords,
                  privateReply: given.privateReply,
                  reply: given.reply,
                  scope,
                };

          const listed = yield* commentRules.start(member, request).pipe(
            Effect.catchTags({
              CommentRuleNotPossible: ruleNotPossible,
              DatabaseError: Effect.die,
              MessagesNeedConsent: notAllowedToRead,
              MissingPermission: (refusal) =>
                notAllowed(
                  refusal.permission === "engagement:message"
                    ? "send private replies"
                    : "answer comments"
                )(refusal),
              TooManyCommentRules: ({ allowed }) =>
                refuse(
                  `The workspace has ${String(allowed)} comment rules going, the most it may: stop one first.`
                ),
            })
          );

          return commentRuleView(listed);
        }),
      stop_comment_rule: ({ ruleId }) =>
        Effect.gen(function* stop() {
          yield* commentRules
            .stop(yield* answerer, yield* ruleIdFrom(ruleId))
            .pipe(
              Effect.catchTags({
                CommentRuleNotFound: noCommentRule,
                DatabaseError: Effect.die,
                MissingPermission: notAllowed("answer comments"),
              })
            );

          return { stopped: ruleId };
        }),
      update_comment_rule: ({
        keywords,
        paused,
        privateReply,
        reply,
        ruleId,
      }) =>
        Effect.gen(function* update() {
          const change: {
            -readonly [
              K in keyof ChangeCommentRuleRequest
            ]: ChangeCommentRuleRequest[K];
          } = {};

          if (keywords !== undefined) {
            change.keywords = keywords;
          }

          if (paused !== undefined) {
            change.paused = paused;
          }

          if (reply !== undefined) {
            change.reply = reply;
          }

          if (privateReply !== undefined) {
            change.privateReply = privateReply;
          }

          const listed = yield* commentRules
            .change(yield* answerer, yield* ruleIdFrom(ruleId), change)
            .pipe(
              Effect.catchTags({
                CommentRuleEnded: ({ reason }) =>
                  refuse(
                    `The comment rule ended (${reason}) and changes no more.`
                  ),
                CommentRuleNotFound: noCommentRule,
                CommentRuleNotPossible: ruleNotPossible,
                DatabaseError: Effect.die,
                MessagesNeedConsent: notAllowedToRead,
                MissingPermission: (refusal) =>
                  notAllowed(
                    refusal.permission === "engagement:message"
                      ? "send private replies"
                      : "answer comments"
                  )(refusal),
              })
            );

          return commentRuleView(listed);
        }),

      get_conversation: ({ conversationId, cursor }) =>
        Effect.gen(function* getConversation() {
          const id = yield* idOr(
            decodeConversationId(conversationId),
            noConversation
          );

          const before = yield* filterOf(cursor, messageCursorOf, "cursor");

          return yield* messages
            .conversation(yield* actor, id, {
              before,
              limit: maxMessagesPerPage,
            })
            .pipe(
              Effect.map(toConversationDetailView),
              Effect.catchTags({
                ConversationNotFound: noConversation,
                DatabaseError: Effect.die,
                MessagesNeedConsent: notAllowedToRead,
                MissingPermission: notAllowed("read direct messages"),
              })
            );
        }),
      list_conversations: ({ channelId, cursor, limit, unread }) =>
        Effect.gen(function* listConversations() {
          const channel = yield* filterOf(
            channelId,
            decodeChannelId,
            "channelId"
          );

          const after = yield* filterOf(cursor, conversationCursorOf, "cursor");

          return yield* messages
            .list(
              yield* actor,
              { channelId: channel, unread: unread ?? false },
              { after, limit: limit ?? defaultInboxPageSize }
            )
            .pipe(
              Effect.map(toConversationPageView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: notAllowed("list direct messages"),
              })
            );
        }),
      send_message: ({ conversationId, idempotencyKey, text }) =>
        Effect.gen(function* sendMessage() {
          const id = yield* idOr(
            decodeConversationId(conversationId),
            noConversation
          );

          const sender = yield* actor;

          return yield* messages
            .send(sender, id, text, Option.fromUndefinedOr(idempotencyKey))
            .pipe(
              Effect.map(toOutgoingMessageView),
              Effect.catchTags({
                AllowanceReached: refusedByMeter(
                  sender.workspaceId,
                  "Nothing was sent."
                ),
                ConversationNotFound: noConversation,
                DatabaseError: Effect.die,
                MessageAbilityUnavailable: cannotMessage,
                MessageMentionsOutside: ({ mentions }) =>
                  refuse(
                    `The message mentions accounts outside the conversation (${mentions.join(", ")}), which a Mastodon direct message would reach too: nothing was sent. Take the mentions out.`
                  ),
                MessagePending: ({ messageId }) =>
                  refuse(
                    `A message to this conversation is on its way, or may have gone out (${messageId}): nothing more was sent. If it is unconfirmed, the user checks the platform and settles it in the web app.`
                  ),
                MessagesNeedConsent: notAllowedToRead,
                MissingPermission: notAllowed("send direct messages"),
                ReplyEmpty: () =>
                  refuse("The message says nothing: nothing was sent."),
                ReplyKeyReused: () =>
                  refuse(
                    "This idempotencyKey was first sent with another conversation or another text: nothing was sent. Call again under a new key."
                  ),
                ReplyTooLong: ({ length, maximum, unit }) =>
                  refuse(
                    `The message is too long for its platform: ${String(length)} ${unit}, where it takes ${String(maximum)} (on Mastodon, the mentions of the participants count). Nothing was sent.`
                  ),
              })
            );
        }),
      send_private_reply: ({ commentId, idempotencyKey, text }) =>
        Effect.gen(function* sendPrivateReply() {
          const id = yield* idOr(decodeCommentId(commentId), noComment);
          const sender = yield* actor;

          return yield* privateReplies
            .send(sender, id, text, Option.fromUndefinedOr(idempotencyKey))
            .pipe(
              Effect.map(toPrivateReplyView),
              Effect.catchTags({
                AbilityUnavailable: ({ standing }) =>
                  refuse(
                    standing === "reconnect"
                      ? "This channel may not send private replies yet: its account was connected before Peal asked for its direct messages' permissions. The user reconnects it for its messages, in the web app. Nothing was sent."
                      : "Nothing was sent: private replies go only on Instagram and Facebook Pages, where this server reads the platform's direct messages and the workspace turned the channel's messages on. The user turns them on in the web app."
                  ),
                AllowanceReached: refusedByMeter(
                  sender.workspaceId,
                  "Nothing was sent."
                ),
                CommentNotFound: noComment,
                DatabaseError: Effect.die,
                MessagesNeedConsent: notAllowedToRead,
                MissingPermission: notAllowed("send private replies"),
                PrivateReplyNotPossible: ({ reason }) =>
                  refuse(privateReplyRefusals[reason]),
                PrivateReplyPending: ({ privateReplyId }) =>
                  refuse(
                    `The comment has its private reply already (${privateReplyId}), on its way, unconfirmed or sent: the platform takes one a comment, so nothing more was sent. Do not call this tool again for it.`
                  ),
                ReplyEmpty: () =>
                  refuse("The message says nothing: nothing was sent."),
                ReplyKeyReused: () =>
                  refuse(
                    "This idempotencyKey was first sent with another comment or another text: nothing was sent. Call again under a new key."
                  ),
                ReplyTooLong: ({ length, maximum, unit }) =>
                  refuse(
                    `The message is too long for its platform: ${String(length)} ${unit}, where it takes ${String(maximum)}. Nothing was sent.`
                  ),
              })
            );
        }),
      delete_location_review_reply: ({ reviewId }) =>
        Effect.gen(function* deleteReply() {
          const id = yield* idOr(decodeReviewId(reviewId), noReview);

          return yield* reviews.withdraw(yield* actor, id).pipe(
            Effect.map(toReviewView),
            Effect.catchTags({
              AbilityUnavailable: unavailable,
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("answer reviews"),
              ReviewActionFailed: notDoneOnGoogle,
              ReviewNotFound: noReview,
              ReviewReplyNeedsPerson: reviewNeedsPerson,
            })
          );
        }),
      get_location_reviews: ({ threadId }) =>
        Effect.gen(function* getReviews() {
          const id = yield* idOr(decodeReviewThreadId(threadId), noLocation);

          return yield* reviews.thread(yield* actor, id).pipe(
            Effect.map(toReviewThreadDetailView),
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("read reviews"),
              ReviewThreadNotFound: noLocation,
            })
          );
        }),
      list_location_reviews: (asked) =>
        Effect.gen(function* listLocations() {
          const channelId = yield* filterOf(
            asked.channelId,
            decodeChannelId,
            "channelId"
          );

          const after = yield* filterOf(asked.cursor, reviewCursorOf, "cursor");

          return yield* reviews
            .threads(
              yield* actor,
              { channelId, unanswered: asked.unanswered ?? false },
              { after, limit: asked.limit ?? defaultInboxPageSize }
            )
            .pipe(
              Effect.map(toReviewThreadPageView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: notAllowed("read reviews"),
              })
            );
        }),
      mark_location_review_answered: ({ answered, reviewId }) =>
        Effect.gen(function* markReview() {
          const id = yield* idOr(decodeReviewId(reviewId), noReview);

          return yield* reviews.setAnswered(yield* actor, id, answered).pipe(
            Effect.map(toReviewView),
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("answer reviews"),
              ReviewNotFound: noReview,
            })
          );
        }),
      reply_to_location_review: ({ reviewId, text }) =>
        Effect.gen(function* replyToReview() {
          const id = yield* idOr(decodeReviewId(reviewId), noReview);

          return yield* reviews.reply(yield* actor, id, text).pipe(
            Effect.map(toReviewReplyView),
            Effect.catchTags({
              AbilityUnavailable: unavailable,
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("answer reviews"),
              ReplyEmpty: () =>
                refuse("The reply says nothing: nothing was sent."),
              ReplyTooLong: ({ length, maximum }) =>
                refuse(
                  `The reply is too long for Google: ${String(length)} bytes, where it takes ${String(maximum)}. Nothing was sent.`
                ),
              ReplyKeyReused: reviewNeedsPerson,
              ReviewNotFound: noReview,
              ReviewReplyNeedsPerson: reviewNeedsPerson,
              ReviewReplyPending: ({ replyId }) =>
                refuse(
                  `A reply to this review is on its way, or its outcome is not known yet (${replyId}): nothing more was sent. The next read of the location settles it.`
                ),
            })
          );
        }),
      confirm_comment_reply: ({ replyId, sent }) =>
        Effect.gen(function* confirm() {
          const id = yield* idOr(decodeReplyId(replyId), noReply);

          return yield* replies.confirm(yield* actor, id, sent).pipe(
            Effect.map(toReplyView),
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidReplyTransition: conflict,
              MissingPermission: notAllowed("answer comments"),
              ReplyNotFound: noReply,
            })
          );
        }),
      get_comment_thread: ({ threadId }) =>
        Effect.gen(function* getThread() {
          const id = yield* idOr(decodeThreadId(threadId), noThread);

          const member = yield* actor;

          return yield* inbox.thread(member, id).pipe(
            Effect.flatMap((detail) =>
              privateReplies
                .ofThread(
                  member,
                  detail.summary.thread.channelId,
                  detail.comments.map(({ id: shown }) => shown)
                )
                .pipe(Effect.map((shown) => toThreadDetailView(detail, shown)))
            ),
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("read comments"),
              ThreadNotFound: noThread,
            })
          );
        }),
      list_comment_threads: (asked) =>
        Effect.gen(function* listThreads() {
          const channelId = yield* filterOf(
            asked.channelId,
            decodeChannelId,
            "channelId"
          );

          const postId = yield* filterOf(asked.postId, decodePostId, "postId");
          const after = yield* filterOf(asked.cursor, cursorOf, "cursor");

          return yield* inbox
            .threads(
              yield* actor,
              { channelId, postId, unanswered: asked.unanswered ?? false },
              { after, limit: asked.limit ?? defaultInboxPageSize }
            )
            .pipe(
              Effect.map(toThreadPageView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: notAllowed("read comments"),
              })
            );
        }),
      mark_comment_answered: ({ answered, commentId }) =>
        Effect.gen(function* markAnswered() {
          const id = yield* idOr(decodeCommentId(commentId), noComment);

          const member = yield* actor;

          return yield* replies.setAnswered(member, id, answered).pipe(
            Effect.flatMap((comment) => commentView(member, comment)),
            Effect.catchTags({
              CommentGone: gone,
              CommentNotFound: noComment,
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("answer comments"),
            })
          );
        }),
      moderate_comment: ({ action, commentId }) =>
        Effect.gen(function* moderate() {
          const id = yield* idOr(decodeCommentId(commentId), noComment);

          const member = yield* actor;

          return yield* replies.moderate(member, id, action).pipe(
            Effect.flatMap((comment) => commentView(member, comment)),
            Effect.catchTags({
              AbilityUnavailable: unavailable,
              CommentGone: gone,
              CommentNotFound: noComment,
              DatabaseError: Effect.die,
              MissingPermission: notAllowed("moderate comments"),
              ModerationFailed: failed,
            })
          );
        }),
      reply_to_comment: ({ commentId, idempotencyKey, text }) =>
        Effect.gen(function* reply() {
          const id = yield* idOr(decodeCommentId(commentId), noComment);
          const replier = yield* actor;

          return yield* replies
            .reply(replier, id, text, Option.fromUndefinedOr(idempotencyKey))
            .pipe(
              Effect.map(toReplyView),
              Effect.catchTags({
                AbilityUnavailable: unavailable,
                AllowanceReached: refusedByMeter(
                  replier.workspaceId,
                  "Nothing was sent."
                ),
                CommentGone: gone,
                CommentNotFound: noComment,
                DatabaseError: Effect.die,
                MissingPermission: notAllowed("answer comments"),
                ReplyEmpty: () =>
                  refuse("The reply says nothing: nothing was sent."),
                ReplyKeyReused: () =>
                  refuse(
                    "This idempotencyKey was first sent with another comment or another text: nothing was made. Call again under a new key."
                  ),
                ReplyPending: ({ replyId }) =>
                  refuse(
                    `A reply to this comment is on its way, or may have gone out (${replyId}): nothing more was sent. If it is unconfirmed, the user checks the platform, then confirm_comment_reply records what they found.`
                  ),
                ReplyTooLong: tooLong,
              })
            );
        }),
      withdraw_comment_reply: ({ replyId }) =>
        Effect.gen(function* withdraw() {
          const id = yield* idOr(decodeReplyId(replyId), noReply);

          return yield* replies.withdraw(yield* actor, id).pipe(
            Effect.map(toReplyView),
            Effect.catchTags({
              AbilityUnavailable: unavailable,
              DatabaseError: Effect.die,
              InvalidReplyTransition: conflict,
              MissingPermission: notAllowed("answer comments"),
              ModerationFailed: failed,
              ReplyNotFound: noReply,
            })
          );
        }),
    });
  })
);
