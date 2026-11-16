import { Duration, Option, Result, Schema } from "effect";
import type { DateTime } from "effect";

import {
  ChannelIdSchema,
  UserIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import type { UserId } from "#shared/domain/ids.ts";

import { ConversationIdSchema } from "./conversation-id.ts";
import type { Conversation } from "./conversation.ts";
import { PlatformMessageIdSchema } from "./direct-message.ts";
import { InvalidOutgoingMessageTransition } from "./invalid-outgoing-message-transition.ts";
import { OutgoingMessageIdSchema } from "./outgoing-message-id.ts";
import type { OutgoingMessageId } from "./outgoing-message-id.ts";
import { ReplyDoubtSchema } from "./reply.ts";

/**
 * Why a message did not go out. Each means the platform shows nothing:
 *
 * - `channelUnavailable`: the channel was disconnected or turned off.
 * - `reconnectNeeded`: the platform refuses the channel's token.
 * - `rateLimited`: the platform asked the account to slow down.
 * - `platformUnavailable`: the platform did not answer, or failed.
 * - `conversationGone`: the conversation is no longer on the platform.
 * - `refused`: the platform refused the message: the person no longer
 *   takes messages from the account, the conversation is locked, or the
 *   text is not allowed there.
 * - `notSent`: its outcome was unknown, and a member found it never went
 *   out.
 * - `windowClosed`: the platform takes answers only for a time after the
 *   person last wrote (Meta's 24 hours), and it had passed.
 * - `humanAgentNotGranted`: Meta refused a person's answer tagged
 *   `HUMAN_AGENT`, as the app does not hold the Human Agent feature.
 * - `tagRestricted`: Meta refused a tagged answer, warning that the app's
 *   use of message tags is restricted or abusive.
 *
 * Stored: add a member, never rename or remove one.
 */
export const MessageFailureSchema = Schema.Literals([
  "channelUnavailable",
  "reconnectNeeded",
  "rateLimited",
  "platformUnavailable",
  "conversationGone",
  "refused",
  "notSent",
  "windowClosed",
  "humanAgentNotGranted",
  "tagRestricted",
]);

export type MessageFailure = typeof MessageFailureSchema.Type;

/** How sending a message ended, as the platform's adapter tells it. */
export const MessageSendOutcomeSchema = Schema.Union([
  Schema.TaggedStruct("sent", { platformMessageId: PlatformMessageIdSchema }),
  Schema.TaggedStruct("failed", { reason: MessageFailureSchema }),
  Schema.TaggedStruct("unconfirmed", { reason: ReplyDoubtSchema }),
]);

export type MessageSendOutcome = typeof MessageSendOutcomeSchema.Type;

export const OutgoingMessageStatusSchema = Schema.Union([
  // Journalled, and on its way. `attemptedAt` is when a run first set out
  // to call the platform: from then on the call may have left, so a later
  // run looks the message up instead of sending it.
  Schema.TaggedStruct("sending", {
    attemptedAt: Schema.Option(Schema.DateTimeUtc),
  }),
  Schema.TaggedStruct("sent", {
    at: Schema.DateTimeUtc,
    // None when a member confirmed by hand a message Peal could not find.
    platformMessageId: Schema.Option(PlatformMessageIdSchema),
  }),
  Schema.TaggedStruct("failed", {
    at: Schema.DateTimeUtc,
    reason: MessageFailureSchema,
  }),
  // It may be on the platform: never sent again, a member checks.
  Schema.TaggedStruct("unconfirmed", {
    at: Schema.DateTimeUtc,
    reason: ReplyDoubtSchema,
  }),
]);

export type OutgoingMessageStatus = typeof OutgoingMessageStatusSchema.Type;

/**
 * A private answer to a conversation, sent from Peal as the channel's
 * account. It is journalled before the platform is called, and sent once:
 * a message whose outcome is unknown is looked up, never sent again. It
 * goes with its conversation.
 */
export class OutgoingMessage extends Schema.Class<OutgoingMessage>(
  "peal-server/engagement/domain/OutgoingMessage"
)({
  // The member who wrote it; none for an API key, or once they closed
  // their account.
  authorId: Schema.Option(UserIdSchema),
  // Whether a member wrote it in person, in their own session of the web
  // app: never an API key, an application (MCP, the command line), staff
  // acting as them, a rule or an automation. Only such a message may be
  // sent with Meta's Human Agent tag, past the 24 hours (`personWindowOf`).
  byPerson: Schema.Boolean,
  channelId: ChannelIdSchema,
  conversationId: ConversationIdSchema,
  createdAt: Schema.DateTimeUtc,
  id: OutgoingMessageIdSchema,
  status: OutgoingMessageStatusSchema,
  text: Schema.NonEmptyString,
  workspaceId: WorkspaceIdSchema,
}) {}

/**
 * How long an idempotency key names the message it made: the same key
 * with the same request answers that message, and never makes another.
 */
export const messageKeyLifetime = Duration.hours(24);

type Transition = Result.Result<
  OutgoingMessage,
  InvalidOutgoingMessageTransition
>;

type Fields = ConstructorParameters<typeof OutgoingMessage>[0];

const withStatus = (
  message: OutgoingMessage,
  status: Fields["status"]
): OutgoingMessage =>
  new OutgoingMessage({
    authorId: message.authorId,
    byPerson: message.byPerson,
    channelId: message.channelId,
    conversationId: message.conversationId,
    createdAt: message.createdAt,
    id: message.id,
    status,
    text: message.text,
    workspaceId: message.workspaceId,
  });

const refused = (message: OutgoingMessage): Transition =>
  Result.fail(
    new InvalidOutgoingMessageTransition({
      from: message.status._tag,
      messageId: message.id,
    })
  );

/**
 * A message to the conversation, about to be journalled and sent: by a
 * member in person in their own session (`byPerson`), or not.
 */
export const writeMessage = (
  id: OutgoingMessageId,
  conversation: Pick<Conversation, "channelId" | "id" | "workspaceId">,
  authorId: Option.Option<UserId>,
  text: string,
  now: DateTime.Utc,
  byPerson = false
): OutgoingMessage =>
  new OutgoingMessage({
    authorId,
    byPerson,
    channelId: conversation.channelId,
    conversationId: conversation.id,
    createdAt: now,
    id,
    status: { _tag: "sending", attemptedAt: Option.none() },
    text,
    workspaceId: conversation.workspaceId,
  });

/**
 * The message as a run sets out to call the platform, recorded before the
 * call. Refused when it is no longer on its way.
 */
export const beginMessage = (
  message: OutgoingMessage,
  now: DateTime.Utc
): Transition =>
  message.status._tag === "sending"
    ? Result.succeed(
        withStatus(message, {
          _tag: "sending",
          attemptedAt: Option.orElse(message.status.attemptedAt, () =>
            Option.some(now)
          ),
        })
      )
    : refused(message);

/**
 * Whether an earlier run may already have called the platform for this
 * message: it is then looked up, never sent again blindly.
 */
export const messageAttempted = (message: OutgoingMessage): boolean =>
  message.status._tag === "sending" &&
  Option.isSome(message.status.attemptedAt);

/** Records how sending ended. Only a message on its way can end. */
export const settleMessage = (
  message: OutgoingMessage,
  outcome: MessageSendOutcome,
  now: DateTime.Utc
): Transition => {
  if (message.status._tag !== "sending") {
    return refused(message);
  }

  if (outcome._tag === "sent") {
    return Result.succeed(
      withStatus(message, {
        _tag: "sent",
        at: now,
        platformMessageId: Option.some(outcome.platformMessageId),
      })
    );
  }

  if (outcome._tag === "failed") {
    return Result.succeed(
      withStatus(message, { _tag: "failed", at: now, reason: outcome.reason })
    );
  }

  return Result.succeed(
    withStatus(message, {
      _tag: "unconfirmed",
      at: now,
      reason: outcome.reason,
    })
  );
};

/**
 * Records what a member found on the platform for a message Peal could
 * not confirm: it is there, or it never went out.
 */
export const confirmMessage = (
  message: OutgoingMessage,
  found: boolean,
  now: DateTime.Utc
): Transition =>
  message.status._tag === "unconfirmed"
    ? Result.succeed(
        withStatus(
          message,
          found
            ? { _tag: "sent", at: now, platformMessageId: Option.none() }
            : { _tag: "failed", at: now, reason: "notSent" }
        )
      )
    : refused(message);

/** The message without its author, once their account is closed. */
export const forgetMessageAuthor = (
  message: OutgoingMessage
): OutgoingMessage =>
  new OutgoingMessage({
    authorId: Option.none(),
    byPerson: message.byPerson,
    channelId: message.channelId,
    conversationId: message.conversationId,
    createdAt: message.createdAt,
    id: message.id,
    status: message.status,
    text: message.text,
    workspaceId: message.workspaceId,
  });
