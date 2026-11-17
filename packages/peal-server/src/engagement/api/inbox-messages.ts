import { Effect, Option, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import {
  Api,
  CurrentMember,
  defaultInboxPageSize,
  maxInboxMessagesPerPage,
  IdempotencyKeyReused,
  InboxActionUnavailable,
  InboxCommentNotFound,
  InboxConversationNotFound,
  InboxMessageNotFound,
  InboxPrivateReplyNotFound,
  MessageMentionsOutside,
  MessagePending,
  PrivateReplyNotPossible,
  PrivateReplyPending,
  ReplyInvalid,
  ReplyStatusConflict,
} from "peal-contract";
import type { Member } from "peal-contract";

import type { AbilityUnavailable } from "#engagement/application/ability-unavailable.ts";
import { EngagementMessages } from "#engagement/application/engagement-messages.ts";
import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import type { MessageAbilityUnavailable } from "#engagement/application/message-ability-unavailable.ts";
import type { MessagePending as PendingMessage } from "#engagement/application/message-pending.ts";
import { MessageSettings } from "#engagement/application/message-settings.ts";
import type { ReplyTooLong } from "#engagement/application/reply-too-long.ts";
import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { ConversationIdSchema } from "#engagement/domain/conversation-id.ts";
import type { InvalidOutgoingMessageTransition } from "#engagement/domain/invalid-outgoing-message-transition.ts";
import type { InvalidPrivateReplyTransition } from "#engagement/domain/invalid-private-reply-transition.ts";
import { OutgoingMessageIdSchema } from "#engagement/domain/outgoing-message-id.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";
import { actorOf } from "#shared/api/actor.ts";
import { allowanceRefusal } from "#shared/api/allowance-reached.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";

import {
  conversationCursorOf,
  messageCursorOf,
  toMessageSettingsView,
  toConversationDetailView,
  toConversationPageView,
  toConversationView,
  toOutgoingMessageView,
} from "./inbox-message-view.ts";
import { toPrivateReplyView } from "./inbox-view.ts";

const decodeConversationId = Schema.decodeUnknownOption(ConversationIdSchema);
const decodeMessageId = Schema.decodeUnknownOption(OutgoingMessageIdSchema);
const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);
const decodeCommentId = Schema.decodeUnknownOption(CommentIdSchema);
const decodePrivateReplyId = Schema.decodeUnknownOption(PrivateReplyIdSchema);

/**
 * Whether the member reached the API in their own session of the web app:
 * the session cookie, not a bearer token (an OAuth client such as MCP or
 * the command line, or an API key), and not staff acting as them. The one
 * proof of a person Meta's Human Agent tag asks for: only this handler
 * gives it.
 */
const inOwnSession = ({ principal }: Member): boolean =>
  principal._tag === "user" &&
  principal.oauth === undefined &&
  principal.impersonatedBy === null;

const commentNotFound = () => Effect.fail(new InboxCommentNotFound());

const privateReplyNotFound = () => Effect.fail(new InboxPrivateReplyNotFound());

const privateUnavailable = ({ ability, standing }: AbilityUnavailable) =>
  Effect.fail(new InboxActionUnavailable({ ability, standing }));

const privateConflict = ({ from }: InvalidPrivateReplyTransition) =>
  Effect.fail(new ReplyStatusConflict({ status: from }));

const conversationNotFound = () => Effect.fail(new InboxConversationNotFound());

const messageNotFound = () => Effect.fail(new InboxMessageNotFound());

const badRequest = () => Effect.fail(new HttpApiError.BadRequest());

// A window that shut says when; every other refusal, its standing alone.
const unavailable = (refusal: MessageAbilityUnavailable) => {
  const { ability, closedAt, standing } = refusal;

  return Effect.fail(
    refusal.reason === "windowClosed" && closedAt !== undefined
      ? new InboxActionUnavailable({
          ability,
          closedAt,
          reason: "windowClosed",
          standing,
        })
      : new InboxActionUnavailable({ ability, standing })
  );
};

const pending = ({ messageId }: PendingMessage) =>
  Effect.fail(new MessagePending({ messageId }));

const conflict = ({ from }: InvalidOutgoingMessageTransition) =>
  Effect.fail(new ReplyStatusConflict({ status: from }));

const tooLong = ({ length, maximum, unit }: ReplyTooLong) =>
  Effect.fail(new ReplyInvalid({ length, maximum, reason: "tooLong", unit }));

const empty = () =>
  Effect.fail(
    new ReplyInvalid({
      length: null,
      maximum: null,
      reason: "empty",
      unit: null,
    })
  );

// An id that is not one of Peal's names nothing: as one not found.
const idOr = <A, E>(
  found: Option.Option<A>,
  missing: () => Effect.Effect<never, E>
): Effect.Effect<A, E> =>
  Option.match(found, { onNone: missing, onSome: Effect.succeed });

// A filter's id that names nothing is a bad request rather than a list
// of everything.
const filterOf = <A>(
  text: string | undefined,
  decode: (value: string) => Option.Option<A>
): Effect.Effect<Option.Option<A>, HttpApiError.BadRequest> => {
  if (text === undefined) {
    return Effect.succeed(Option.none());
  }

  return Option.match(decode(text), {
    onNone: badRequest,
    onSome: (id) => Effect.succeed(Option.some(id)),
  });
};

// A failure of the server's own (the database, a bug) is a defect: 500.
export const InboxMessagesHandlers = HttpApiBuilder.group(
  Api,
  "inboxMessages",
  Effect.fn(function* inboxMessagesHandlers(handlers) {
    const messages = yield* EngagementMessages;
    const settings = yield* MessageSettings;
    const privateReplies = yield* EngagementPrivateReplies;
    const allowance = yield* allowanceRefusal;

    return handlers.handleAll({
      confirmPrivateReply: ({ params, payload }) =>
        Effect.gen(function* confirmPrivateReply() {
          const actor = actorOf(yield* CurrentMember);

          const privateReplyId = yield* idOr(
            decodePrivateReplyId(params.privateReplyId),
            privateReplyNotFound
          );

          return yield* privateReplies
            .confirm(actor, privateReplyId, payload.went)
            .pipe(
              Effect.map(toPrivateReplyView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                InvalidPrivateReplyTransition: privateConflict,
                MessagesNeedConsent: forbidden,
                MissingPermission: forbidden,
                PrivateReplyNotFound: privateReplyNotFound,
              })
            );
        }),
      getPrivateReply: ({ params }) =>
        Effect.gen(function* getPrivateReply() {
          const actor = actorOf(yield* CurrentMember);

          const privateReplyId = yield* idOr(
            decodePrivateReplyId(params.privateReplyId),
            privateReplyNotFound
          );

          return yield* privateReplies.privateReply(actor, privateReplyId).pipe(
            Effect.map(toPrivateReplyView),
            Effect.catchTags({
              DatabaseError: Effect.die,
              MessagesNeedConsent: forbidden,
              MissingPermission: forbidden,
              PrivateReplyNotFound: privateReplyNotFound,
            })
          );
        }),
      sendPrivateReply: ({ headers, payload }) =>
        Effect.gen(function* sendPrivateReply() {
          const actor = actorOf(yield* CurrentMember);

          const commentId = yield* idOr(
            decodeCommentId(payload.commentId),
            commentNotFound
          );

          return yield* privateReplies
            .send(
              actor,
              commentId,
              payload.text,
              Option.fromUndefinedOr(headers["idempotency-key"])
            )
            .pipe(
              Effect.map(toPrivateReplyView),
              Effect.catchTags({
                AbilityUnavailable: privateUnavailable,
                AllowanceReached: allowance,
                CommentNotFound: commentNotFound,
                DatabaseError: Effect.die,
                MessagesNeedConsent: forbidden,
                MissingPermission: forbidden,
                PrivateReplyNotPossible: ({ reason }) =>
                  Effect.fail(new PrivateReplyNotPossible({ reason })),
                PrivateReplyPending: ({ privateReplyId }) =>
                  Effect.fail(new PrivateReplyPending({ privateReplyId })),
                ReplyEmpty: empty,
                ReplyKeyReused: () => Effect.fail(new IdempotencyKeyReused()),
                ReplyTooLong: tooLong,
              })
            );
        }),
      confirmMessage: ({ params, payload }) =>
        Effect.gen(function* confirmMessage() {
          const actor = actorOf(yield* CurrentMember);

          const messageId = yield* idOr(
            decodeMessageId(params.messageId),
            messageNotFound
          );

          return yield* messages.confirm(actor, messageId, payload.sent).pipe(
            Effect.map(toOutgoingMessageView),
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidOutgoingMessageTransition: conflict,
              MessagesNeedConsent: forbidden,
              MissingPermission: forbidden,
              OutgoingMessageNotFound: messageNotFound,
            })
          );
        }),
      getConversation: ({ params, query }) =>
        Effect.gen(function* getConversation() {
          const actor = actorOf(yield* CurrentMember);

          const conversationId = yield* idOr(
            decodeConversationId(params.conversationId),
            conversationNotFound
          );

          const before = yield* filterOf(query.cursor, messageCursorOf);

          return yield* messages
            .conversation(actor, conversationId, {
              before,
              limit: query.limit ?? maxInboxMessagesPerPage,
            })
            .pipe(
              Effect.map(toConversationDetailView),
              Effect.catchTags({
                ConversationNotFound: conversationNotFound,
                DatabaseError: Effect.die,
                MessagesNeedConsent: forbidden,
                MissingPermission: forbidden,
              })
            );
        }),
      getMessageSettings: () =>
        Effect.gen(function* getMessageSettings() {
          const actor = actorOf(yield* CurrentMember);

          return yield* settings.settings(actor).pipe(
            Effect.map(toMessageSettingsView),
            Effect.catchTags({
              DatabaseError: Effect.die,
              MessagesNeedPerson: forbidden,
              MissingPermission: forbidden,
            })
          );
        }),
      setChannelMessages: ({ params, payload }) =>
        Effect.gen(function* setChannelMessages() {
          const actor = actorOf(yield* CurrentMember);
          const channelId = decodeChannelId(params.channelId);

          if (Option.isNone(channelId)) {
            return yield* new InboxActionUnavailable({
              ability: "read",
              standing: "unsupported",
            });
          }

          return yield* settings
            .switchChannel(actor, channelId.value, payload.enabled)
            .pipe(
              Effect.map(toMessageSettingsView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                MessageAbilityUnavailable: unavailable,
                MessagesNeedPerson: forbidden,
                MissingPermission: forbidden,
              })
            );
        }),
      setMessageApplication: ({ payload }) =>
        Effect.gen(function* setMessageApplication() {
          const actor = actorOf(yield* CurrentMember);

          return yield* settings
            .allowApplication(actor, payload.clientId, payload.allowed)
            .pipe(
              Effect.map(toMessageSettingsView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                MessagesNeedPerson: forbidden,
                MissingPermission: forbidden,
              })
            );
        }),
      listConversations: ({ query }) =>
        Effect.gen(function* listConversations() {
          const actor = actorOf(yield* CurrentMember);
          const channelId = yield* filterOf(query.channelId, decodeChannelId);
          const after = yield* filterOf(query.cursor, conversationCursorOf);

          return yield* messages
            .list(
              actor,
              { channelId, unread: query.unread === "true" },
              { after, limit: query.limit ?? defaultInboxPageSize }
            )
            .pipe(
              Effect.map(toConversationPageView),
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
              })
            );
        }),
      sendMessage: ({ headers, params, payload }) =>
        Effect.gen(function* sendMessage() {
          const member = yield* CurrentMember;
          const actor = actorOf(member);

          const conversationId = yield* idOr(
            decodeConversationId(params.conversationId),
            conversationNotFound
          );

          return yield* messages
            .send(
              actor,
              conversationId,
              payload.text,
              Option.fromUndefinedOr(headers["idempotency-key"]),
              { inSession: inOwnSession(member) }
            )
            .pipe(
              Effect.map(toOutgoingMessageView),
              Effect.catchTags({
                AllowanceReached: allowance,
                ConversationNotFound: conversationNotFound,
                DatabaseError: Effect.die,
                MessageAbilityUnavailable: unavailable,
                MessageMentionsOutside: ({ mentions }) =>
                  Effect.fail(new MessageMentionsOutside({ mentions })),
                MessagePending: pending,
                MessagesNeedConsent: forbidden,
                MissingPermission: forbidden,
                ReplyEmpty: empty,
                ReplyKeyReused: () => Effect.fail(new IdempotencyKeyReused()),
                ReplyTooLong: tooLong,
              })
            );
        }),
      setConversationRead: ({ params, payload }) =>
        Effect.gen(function* setConversationRead() {
          const actor = actorOf(yield* CurrentMember);

          const conversationId = yield* idOr(
            decodeConversationId(params.conversationId),
            conversationNotFound
          );

          return yield* messages
            .markRead(actor, conversationId, payload.read)
            .pipe(
              Effect.map((marked) =>
                toConversationView(marked.conversation, marked.messages)
              ),
              Effect.catchTags({
                ConversationNotFound: conversationNotFound,
                DatabaseError: Effect.die,
                MessagesNeedConsent: forbidden,
                MissingPermission: forbidden,
              })
            );
        }),
    });
  })
);
