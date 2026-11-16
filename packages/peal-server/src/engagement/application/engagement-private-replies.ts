import { Context, DateTime, Effect, Layer, Option, Result } from "effect";

import type { CommentId } from "#engagement/domain/comment-id.ts";
import type { CommentRuleId } from "#engagement/domain/comment-rule-id.ts";
import type { AbilityStanding } from "#engagement/domain/engagement-abilities.ts";
import type { InvalidPrivateReplyTransition } from "#engagement/domain/invalid-private-reply-transition.ts";
import { readsMessagesOn } from "#engagement/domain/message-abilities.ts";
import {
  chatOverflow,
  maxOutgoingMessageLength,
} from "#engagement/domain/message-text.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";
import { privateReplyStanding } from "#engagement/domain/private-reply-standing.ts";
import {
  confirmPrivateReply,
  mayReplyPrivately,
  privateReplyKeyLifetime,
  writePrivateReply,
} from "#engagement/domain/private-reply.ts";
import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { CurrentInboxPlatforms } from "#shared/application/current-inbox-platforms.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { Ids, newId } from "#shared/application/ids.ts";
import { MeteredUsage, pausedOf } from "#shared/application/metered-usage.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { AllowanceReached } from "#shared/domain/allowance-reached.ts";
import { authorize } from "#shared/domain/authorize.ts";
import type { ChannelId, UserId } from "#shared/domain/ids.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import { storableText } from "#shared/domain/platform-text.ts";
import type { Platform } from "#shared/domain/platform.ts";

import { AbilityUnavailable } from "./ability-unavailable.ts";
import { CommentNotFound } from "./comment-not-found.ts";
import { MessagesNeedConsent } from "./messages-need-consent.ts";
import { EngagementChannels } from "./ports/engagement-channels.ts";
import type { EngagedChannel } from "./ports/engagement-channels.ts";
import { EngagementStore } from "./ports/engagement-store.ts";
import { MessageStore } from "./ports/message-store.ts";
import { PrivateReplyJobs } from "./ports/private-reply-jobs.ts";
import { PrivateReplyStore } from "./ports/private-reply-store.ts";
import type { PrivateReplyJournalled } from "./ports/private-reply-store.ts";
import { claimOfPrivateReply } from "./private-reply-claim.ts";
import { PrivateReplyNotFound } from "./private-reply-not-found.ts";
import { PrivateReplyNotPossible } from "./private-reply-not-possible.ts";
import { PrivateReplyPending } from "./private-reply-pending.ts";
import { ReplyEmpty } from "./reply-empty.ts";
import { ReplyKeyReused } from "./reply-key-reused.ts";
import { ReplyTooLong } from "./reply-too-long.ts";

type Refused = DatabaseError | MessagesNeedConsent | MissingPermission;

// The member who writes: none for an API key, which is nobody.
const writerOf = (actor: Actor): Option.Option<UserId> =>
  actor.subject._tag === "user"
    ? Option.some(actor.subject.userId)
    : Option.none();

// The text, if it is one the platform takes: not empty, within what a
// member may write, and within the platform's message length.
const textFits = (
  platform: Platform,
  text: string,
  messages: InboxMessagePlatforms
): Effect.Effect<void, ReplyEmpty | ReplyTooLong> => {
  if (text.trim() === "") {
    return Effect.fail(new ReplyEmpty());
  }

  if (text.length > maxOutgoingMessageLength) {
    return Effect.fail(
      new ReplyTooLong({
        length: text.length,
        maximum: maxOutgoingMessageLength,
        unit: "characters",
      })
    );
  }

  const overflow = readsMessagesOn(platform, messages)
    ? chatOverflow(platform, text)
    : Option.none();

  return Option.match(overflow, {
    onNone: () => Effect.void,
    onSome: (over) => Effect.fail(new ReplyTooLong(over)),
  });
};

// What the journal's answer means for the request.
const answerOf = (
  journalled: PrivateReplyJournalled,
  written: PrivateReply
): Effect.Effect<
  PrivateReply,
  CommentNotFound | PrivateReplyPending | ReplyKeyReused
> => {
  switch (journalled._tag) {
    case "journalled": {
      return Effect.succeed(written);
    }

    case "replayed": {
      return Effect.succeed(journalled.reply);
    }

    case "pending": {
      return Effect.fail(
        new PrivateReplyPending({
          commentId: written.commentId,
          privateReplyId: journalled.privateReplyId,
        })
      );
    }

    case "keyReused": {
      return Effect.fail(new ReplyKeyReused());
    }

    case "dropped": {
      return Effect.fail(new CommentNotFound({ commentId: written.commentId }));
    }

    default: {
      return journalled satisfies never;
    }
  }
};

/** What a thread's view shows of private replies, for one actor. */
export interface ThreadPrivateReplies {
  /** When it was read: a comment past its window is offered none. */
  readonly now: DateTime.Utc;
  /** Whether the thread's channel can send one now. */
  readonly standing: AbilityStanding;
  /**
   * The private replies to the thread's comments, oldest first: none for
   * an actor who may not read the workspace's messages.
   */
  readonly replies: readonly PrivateReply[];
}

/**
 * The one private message a member, or a comment rule a member set,
 * sends the author of a comment under one of the workspace's posts, on
 * Instagram or a Facebook Page, in answer to that comment. It is private
 * correspondence, so it takes what answering a direct message takes
 * (`engagement:message`, and an application the owner's leave), and the
 * channel's messages turned on: the person's answer comes as one.
 *
 * Each is checked, in this order, before anything is reserved: the
 * permission, the comment (in the workspace, someone else's, still shown,
 * written within `privateReplyWindow`), the channel's standing, the text,
 * and the meter. Then the journal row, its outbound message and its job,
 * in one transaction. The database holds one a comment while it is on its
 * way, unconfirmed or sent, and one a key. One that ends as never sent
 * gives its outbound message back.
 */
export class EngagementPrivateReplies extends Context.Service<
  EngagementPrivateReplies,
  {
    readonly send: (
      actor: Actor,
      commentId: CommentId,
      text: string,
      /**
       * The request's idempotency key, if it came with one: within
       * `privateReplyKeyLifetime` the same key with the same comment and
       * text answers the private reply the first request made.
       */
      key?: Option.Option<string>,
      /** The comment rule that sends it; none for a member's own. */
      ruleId?: Option.Option<CommentRuleId>
    ) => Effect.Effect<
      PrivateReply,
      | AbilityUnavailable
      | AllowanceReached
      | CommentNotFound
      | PrivateReplyNotPossible
      | PrivateReplyPending
      | Refused
      | ReplyEmpty
      | ReplyKeyReused
      | ReplyTooLong
    >;
    readonly privateReply: (
      actor: Actor,
      privateReplyId: string
    ) => Effect.Effect<PrivateReply, PrivateReplyNotFound | Refused>;
    /** Records what a member found for an unconfirmed private reply. */
    readonly confirm: (
      actor: Actor,
      privateReplyId: string,
      went: boolean
    ) => Effect.Effect<
      PrivateReply,
      InvalidPrivateReplyTransition | PrivateReplyNotFound | Refused
    >;
    /**
     * Whether the channel can send a private reply now, and the private
     * replies to the comments the actor may see, for a thread's view.
     */
    readonly ofThread: (
      actor: Actor,
      channelId: ChannelId,
      commentIds: readonly CommentId[]
    ) => Effect.Effect<ThreadPrivateReplies, DatabaseError>;
    /** Whether the channel can send a private reply now. */
    readonly standingOf: (
      actor: Actor,
      channelId: ChannelId
    ) => Effect.Effect<AbilityStanding, DatabaseError>;
  }
>()("peal-server/engagement/application/EngagementPrivateReplies") {
  static readonly layer = Layer.effect(
    EngagementPrivateReplies,
    Effect.gen(function* EngagementPrivateRepliesLive() {
      const store = yield* PrivateReplyStore;
      const comments = yield* EngagementStore;
      const messageStore = yield* MessageStore;
      const channels = yield* EngagementChannels;
      const jobs = yield* PrivateReplyJobs;
      const inbox = yield* CurrentInboxPlatforms;
      const messages = yield* CurrentInboxMessages;
      const { transaction } = yield* TransactionRunner;
      const ids = yield* Ids;
      const meters = yield* MeteredUsage;

      // An application acting for a member answers privately only where
      // the workspace's owner let it, as with direct messages.
      const consented = Effect.fn("EngagementPrivateReplies.consented")(
        function* consented(actor: Actor) {
          const { subject } = actor;

          const allowed =
            subject._tag !== "user" ||
            subject.clientId === undefined ||
            (yield* messageStore.allows(actor.workspaceId, subject.clientId));

          return yield* allowed
            ? Effect.void
            : Effect.fail(new MessagesNeedConsent());
        }
      );

      // Whether the actor may see private correspondence: what reading
      // direct messages takes. Never fails: one who may not sees none.
      const mayRead = (actor: Actor) =>
        Effect.fromResult(authorize(actor, "engagement:readMessages")).pipe(
          Effect.andThen(consented(actor)),
          Effect.as(true),
          Effect.catchTags({
            MessagesNeedConsent: () => Effect.succeed(false),
            MissingPermission: () => Effect.succeed(false),
          })
        );

      // The channel, when it is connected, on and working.
      // The channel, when it is connected, on and working; one whose token
      // ran out stands as its platform granting nothing until it is
      // connected again, so its standing says to reconnect.
      const channelOf = (channelId: ChannelId) =>
        channels.describe(channelId).pipe(
          Effect.map(Option.some),
          Effect.catchTag("ChannelUnreadable", ({ platform, reason }) =>
            Effect.succeed(
              reason === "paused" && platform !== undefined
                ? Option.some<EngagedChannel>({
                    connection: Option.none(),
                    platform,
                    scopes: [],
                  })
                : Option.none<EngagedChannel>()
            )
          )
        );

      // The channel's standing in the actor's workspace: its messages
      // must be on there, which a Page in another workspace says nothing
      // of.
      const standingIn = Effect.fn("EngagementPrivateReplies.standingIn")(
        function* standingIn(
          actor: Actor,
          channelId: ChannelId,
          channel: Option.Option<EngagedChannel>
        ) {
          if (Option.isNone(channel)) {
            return "unsupported" as const;
          }

          const { connection, platform, scopes } = channel.value;

          if (!readsMessagesOn(platform, messages)) {
            return "unsupported" as const;
          }

          const on = (yield* messageStore.switchedOn(actor.workspaceId)).some(
            (switched) => switched.channelId === channelId
          );

          return privateReplyStanding(
            platform,
            connection,
            scopes,
            inbox,
            messages,
            on
          );
        }
      );

      const commentOf = Effect.fn("EngagementPrivateReplies.comment")(
        function* commentOf(actor: Actor, commentId: CommentId) {
          const found = yield* comments.comment(commentId);

          if (
            Option.isNone(found) ||
            found.value.workspaceId !== actor.workspaceId
          ) {
            return yield* new CommentNotFound({ commentId });
          }

          return found.value;
        }
      );

      const send = Effect.fn("EngagementPrivateReplies.send")(function* send(
        actor: Actor,
        commentId: CommentId,
        typed: string,
        key: Option.Option<string> = Option.none(),
        ruleId: Option.Option<CommentRuleId> = Option.none()
      ) {
        // Staff acting as a member hold neither permission.
        yield* Effect.fromResult(authorize(actor, "engagement:message"));
        yield* consented(actor);

        const comment = yield* commentOf(actor, commentId);
        const channel = yield* channelOf(comment.channelId);
        const now = yield* DateTime.now;

        // What a member typed is made storable like any text from outside.
        const text = storableText(typed, maxOutgoingMessageLength + 1);

        // Checked before the reply is written, which takes a text: one
        // that cleans to nothing is a refusal, never a fault. The
        // platform's own length comes once its standing is known.
        if (text.trim() === "") {
          return yield* new ReplyEmpty();
        }

        const written = writePrivateReply(
          yield* newId(PrivateReplyIdSchema).pipe(
            Effect.provideService(Ids, ids)
          ),
          comment,
          writerOf(actor),
          text,
          ruleId,
          now
        );

        const given = key.pipe(
          Option.map((value) => ({
            key: value,
            since: DateTime.subtractDuration(now, privateReplyKeyLifetime),
          }))
        );

        // Meta's seven days, from when the comment was written: refused
        // before anything is journalled or claimed. A key sent again
        // answers what it made while they were open.
        const possible = mayReplyPrivately(
          comment,
          now,
          channel.pipe(
            Option.flatMap(({ accountId }) => Option.fromUndefinedOr(accountId))
          )
        );

        if (Result.isFailure(possible)) {
          const made = Option.isSome(given)
            ? yield* store.madeWithKey(written, given.value)
            : Option.none();

          if (Option.isSome(made) && made.value._tag === "replayed") {
            return made.value.reply;
          }

          return yield* new PrivateReplyNotPossible({
            commentId,
            reason: possible.failure,
          });
        }

        const standing = yield* standingIn(actor, comment.channelId, channel);

        if (standing !== "available" || Option.isNone(channel)) {
          return yield* new AbilityUnavailable({
            ability: "privateReply",
            standing: standing === "reconnect" ? "reconnect" : "unsupported",
          });
        }

        yield* textFits(channel.value.platform, text, messages);

        // A paused meter refuses before anything is journalled; a request
        // with a key goes to the journal first, which answers the private
        // reply the key made, however the meter stands now.
        const paused = Option.isSome(key)
          ? Option.none()
          : (yield* meters.state(actor.workspaceId, "outboundMessages")).pipe(
              Option.flatMap(pausedOf)
            );

        if (Option.isSome(paused)) {
          return yield* paused.value;
        }

        // The journal row, its outbound message and its job, together. A
        // message the billing account has no allowance for undoes it all.
        const journalled = yield* transaction(
          store
            .journal(written, given)
            .pipe(
              Effect.tap((made) =>
                made._tag === "journalled"
                  ? meters
                      .claim(
                        actor.workspaceId,
                        "outboundMessages",
                        1,
                        written.createdAt
                      )
                      .pipe(Effect.andThen(jobs.start(written.id)))
                  : Effect.void
              )
            )
        );

        return yield* answerOf(journalled, written);
      });

      const inWorkspace = Effect.fn("EngagementPrivateReplies.inWorkspace")(
        function* inWorkspace(actor: Actor, privateReplyId: string) {
          const found = yield* store.privateReply(privateReplyId);

          if (
            Option.isNone(found) ||
            found.value.workspaceId !== actor.workspaceId
          ) {
            return yield* new PrivateReplyNotFound({ privateReplyId });
          }

          return found.value;
        }
      );

      const privateReply = Effect.fn("EngagementPrivateReplies.privateReply")(
        function* privateReply(actor: Actor, privateReplyId: string) {
          yield* Effect.fromResult(authorize(actor, "engagement:readMessages"));
          yield* consented(actor);

          return yield* inWorkspace(actor, privateReplyId);
        }
      );

      const confirm = Effect.fn("EngagementPrivateReplies.confirm")(
        function* confirm(actor: Actor, privateReplyId: string, went: boolean) {
          yield* Effect.fromResult(authorize(actor, "engagement:message"));
          yield* consented(actor);

          const unconfirmed = yield* inWorkspace(actor, privateReplyId);

          const confirmed = yield* Effect.fromResult(
            confirmPrivateReply(unconfirmed, went, yield* DateTime.now)
          );

          return yield* transaction(
            Effect.gen(function* confirming() {
              if (!(yield* store.advance(confirmed, unconfirmed))) {
                return yield* new PrivateReplyNotFound({ privateReplyId });
              }

              // What a person found is final: no job of it may act after.
              yield* jobs.cancel(confirmed.id);

              // One that never went out gives its outbound message back.
              if (!went) {
                yield* meters.giveBack(claimOfPrivateReply(confirmed));
              }

              return confirmed;
            })
          );
        }
      );

      const standingOf = Effect.fn("EngagementPrivateReplies.standingOf")(
        function* standingOf(actor: Actor, channelId: ChannelId) {
          return yield* standingIn(
            actor,
            channelId,
            yield* channelOf(channelId)
          );
        }
      );

      const ofThread = Effect.fn("EngagementPrivateReplies.ofThread")(
        function* ofThread(
          actor: Actor,
          channelId: ChannelId,
          commentIds: readonly CommentId[]
        ) {
          const standing = yield* standingOf(actor, channelId);

          const replies = (yield* mayRead(actor))
            ? (yield* store.ofComments(commentIds)).filter(
                (reply) => reply.workspaceId === actor.workspaceId
              )
            : [];

          const thread: ThreadPrivateReplies = {
            now: yield* DateTime.now,
            replies,
            standing,
          };

          return thread;
        }
      );

      return EngagementPrivateReplies.of({
        confirm,
        ofThread,
        privateReply,
        send,
        standingOf,
      });
    })
  );
}
