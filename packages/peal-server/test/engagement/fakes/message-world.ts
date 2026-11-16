import { DateTime, Effect, Layer, Option, Result } from "effect";

import { ChannelUnreadable } from "#engagement/application/channel-unreadable.ts";
import { CollectMessages } from "#engagement/application/collect-messages.ts";
import { EngagementMessages } from "#engagement/application/engagement-messages.ts";
import { MessageSettings } from "#engagement/application/message-settings.ts";
import { EngagementChannels } from "#engagement/application/ports/engagement-channels.ts";
import type { EngagedChannel } from "#engagement/application/ports/engagement-channels.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";
import type { AccountChannel } from "#engagement/application/ports/message-channels-of-account.ts";
import { MessageJobs } from "#engagement/application/ports/message-jobs.ts";
import { MessageOutcomes } from "#engagement/application/ports/message-outcomes.ts";
import { MessageSender } from "#engagement/application/ports/message-sender.ts";
import type { MessageSendRequest } from "#engagement/application/ports/message-sender.ts";
import { MessageSource } from "#engagement/application/ports/message-source.ts";
import type {
  MessagesBatch,
  MessagesFollowOutcome,
  MessagesFollowRequest,
  MessagesReadFailure,
  MessagesRequest,
} from "#engagement/application/ports/message-source.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import type {
  ConversationSummary,
  MessageJournalled,
  MessagesApplication,
  MessagesSwitchedOn,
} from "#engagement/application/ports/message-store.ts";
import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";
import { ReplyLimits } from "#engagement/application/ports/reply-limits.ts";
import { PurgeMessages } from "#engagement/application/purge-messages.ts";
import { ReceiveMessageEvents } from "#engagement/application/receive-message-events.ts";
import { SendMessage } from "#engagement/application/send-message.ts";
import { isUnread } from "#engagement/domain/conversation.ts";
import type { Conversation } from "#engagement/domain/conversation.ts";
import type { DirectMessage } from "#engagement/domain/direct-message.ts";
import { MessageBox } from "#engagement/domain/message-box.ts";
import type { OutgoingMessageId } from "#engagement/domain/outgoing-message-id.ts";
import { settleMessage } from "#engagement/domain/outgoing-message.ts";
import type {
  MessageSendOutcome,
  OutgoingMessage,
} from "#engagement/domain/outgoing-message.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { Ids } from "#shared/application/ids.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { blueskyChatScopes } from "#shared/domain/bluesky-scopes.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { facebookMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";

import { noPrivateReplies } from "./no-private-replies.ts";

// The direct message use cases on memory: a store that keeps what the
// Postgres one keeps, the channels the channels context lists, a platform
// that answers what a test says, and a record of what the workspace was
// told.

const millis = (at: DateTime.Utc) => DateTime.toEpochMillis(at);

// The box with some of its fields changed.
const boxWith = (
  box: MessageBox,
  changed: Partial<
    Pick<MessageBox, "lastReadAt" | "nextReadAt" | "notBefore" | "subscribedAt">
  >
) =>
  new MessageBox({
    channelId: box.channelId,
    createdAt: box.createdAt,
    lastReadAt: changed.lastReadAt ?? box.lastReadAt,
    nextReadAt: changed.nextReadAt ?? box.nextReadAt,
    notBefore: changed.notBefore ?? box.notBefore,
    subscribedAt: changed.subscribedAt ?? box.subscribedAt,
    workspaceId: box.workspaceId,
  });

/** A Mastodon channel that granted what Peal's sign-in asks. */
export const mastodonChannel: EngagedChannel = {
  connection: Option.none(),
  platform: "mastodon",
  scopes: ["profile", "read:statuses", "write:statuses", "write:media"],
};

/** A Bluesky channel that granted the chat scopes. */
export const blueskyChannel: EngagedChannel = {
  connection: Option.none(),
  platform: "bluesky",
  scopes: ["atproto", ...blueskyChatScopes],
};

/** A Facebook Page that granted Meta's messaging permissions. */
export const facebookChannel: EngagedChannel = {
  connection: Option.none(),
  platform: "facebook",
  scopes: ["pages_show_list", ...facebookMessageScopes],
};

export interface MessageWorldState {
  /** The channels of each account, by `<platform>:<account id>`. */
  readonly accounts: Map<string, AccountChannel[]>;
  readonly boxes: Map<ChannelId, MessageBox>;
  /**
   * The reads of one box started, once a channel and slot, as the
   * workflow engine starts one execution an idempotency key.
   */
  readonly boxReads: { readonly channelId: ChannelId; readonly slot: string }[];
  /** The channels whose platform was asked to tell their events. */
  readonly follows: ChannelId[];
  /** What asking a platform for, or to stop, its events answers. */
  following: (
    request: MessagesFollowRequest
  ) => Effect.Effect<MessagesFollowOutcome, MessagesReadFailure>;
  /** The channels whose platform was asked to stop telling their events. */
  readonly unfollows: ChannelId[];
  readonly cancelled: OutgoingMessageId[];
  readonly channels: Map<ChannelId, EngagedChannel>;
  readonly applications: MessagesApplication[];
  readonly switchedOn: Map<ChannelId, MessagesSwitchedOn>;
  readonly conversations: Map<string, Conversation>;
  readonly jobs: OutgoingMessageId[];
  readonly keys: Map<string, OutgoingMessageId>;
  readonly messages: Map<string, DirectMessage>;
  readonly outgoing: Map<string, OutgoingMessage>;
  read: (
    request: MessagesRequest
  ) => Effect.Effect<MessagesBatch, MessagesReadFailure>;
  readonly reads: MessagesRequest[];
  readonly received: {
    readonly conversation: Conversation;
    readonly messages: readonly DirectMessage[];
  }[];
  readonly resumed: MessageSendRequest[];
  resuming: MessageSendOutcome;
  readonly sent: MessageSendRequest[];
  sending: MessageSendOutcome;
  readonly settled: OutgoingMessage[];
  /** The boxes whose messages were turned off, as members were told. */
  readonly turnedOff: {
    readonly channelId: ChannelId;
    readonly workspaceId: string;
  }[];
}

export const makeMessageWorld = (
  messages: InboxMessagePlatforms = new Set(["mastodon", "bluesky"]),
  meters: Layer.Layer<MeteredUsage> = MeteredUsage.layerUnmetered
) => {
  const state: MessageWorldState = {
    accounts: new Map(),
    boxReads: [],
    boxes: new Map(),
    follows: [],
    following: () => Effect.succeed("unneeded"),
    unfollows: [],
    cancelled: [],
    channels: new Map(),
    applications: [],
    switchedOn: new Map(),
    conversations: new Map(),
    jobs: [],
    keys: new Map(),
    messages: new Map(),
    outgoing: new Map(),
    read: () =>
      Effect.succeed({
        conversations: [],
        halted: false,
        listed: [],
        listedWhole: false,
      }),
    reads: [],
    received: [],
    resumed: [],
    resuming: { _tag: "unconfirmed", reason: "noResponse" },
    sent: [],
    sending: { _tag: "sent", platformMessageId: "m-sent" },
    settled: [],
    turnedOff: [],
  };

  const summaryOf = (conversation: Conversation): ConversationSummary => ({
    conversation,
    messages: [...state.messages.values()].filter(
      (message) => message.conversationId === conversation.id
    ).length,
  });

  // The conversations a whole listing last missed.
  const unlisted = new Set<string>();

  const pending = (conversationId: string) =>
    [...state.outgoing.values()].find(
      (message) =>
        message.conversationId === conversationId &&
        (message.status._tag === "sending" ||
          message.status._tag === "unconfirmed")
    );

  const dropConversation = (id: string) => {
    state.conversations.delete(id);

    for (const [key, message] of state.messages) {
      if (message.conversationId === id) {
        state.messages.delete(key);
      }
    }

    for (const [key, message] of state.outgoing) {
      if (message.conversationId === id) {
        state.outgoing.delete(key);
      }
    }
  };

  const channelGone = (channelId: ChannelId) => {
    state.switchedOn.delete(channelId);
    state.boxes.delete(channelId);

    const gone = [...state.conversations.values()].filter(
      (conversation) => conversation.channelId === channelId
    );

    for (const conversation of gone) {
      dropConversation(conversation.id);
    }

    return gone.length;
  };

  const store = MessageStore.of({
    allowApplication: (allowed) =>
      Effect.sync(() => {
        if (
          !state.applications.some(
            (kept) =>
              kept.workspaceId === allowed.workspaceId &&
              kept.clientId === allowed.clientId
          )
        ) {
          state.applications.push(allowed);
        }
      }),
    allows: (workspaceId, clientId) =>
      Effect.sync(() =>
        state.applications.some(
          (kept) =>
            kept.workspaceId === workspaceId && kept.clientId === clientId
        )
      ),
    applications: (workspaceId) =>
      Effect.sync(() =>
        state.applications.filter((kept) => kept.workspaceId === workspaceId)
      ),
    clearUnlisted: (channelId, listed) =>
      Effect.sync(() => {
        for (const conversation of state.conversations.values()) {
          if (
            conversation.channelId === channelId &&
            listed.includes(conversation.platformConversationId)
          ) {
            unlisted.delete(conversation.id);
          }
        }
      }),
    dropUnlisted: (channelId, listed) =>
      Effect.sync(() => {
        const ofBox = [...state.conversations.values()].filter(
          (conversation) => conversation.channelId === channelId
        );

        let gone = 0;

        for (const conversation of ofBox) {
          if (listed.includes(conversation.platformConversationId)) {
            unlisted.delete(conversation.id);
          } else if (!unlisted.has(conversation.id)) {
            unlisted.add(conversation.id);
          } else if (pending(conversation.id) === undefined) {
            dropConversation(conversation.id);
            unlisted.delete(conversation.id);
            gone += 1;
          }
        }

        return gone;
      }),
    pageOfMessages: (conversationId, page) =>
      Effect.sync(() =>
        [...state.messages.values()]
          .filter(
            (message) =>
              message.conversationId === conversationId &&
              Option.match(page.before, {
                onNone: () => true,
                onSome: (cursor) =>
                  millis(message.sentAt) < millis(cursor.sentAt) ||
                  (millis(message.sentAt) === millis(cursor.sentAt) &&
                    message.id < cursor.messageId),
              })
          )
          .toSorted(
            (left, right) =>
              millis(right.sentAt) - millis(left.sentAt) ||
              right.id.localeCompare(left.id)
          )
          .slice(0, page.limit)
      ),
    revokeApplication: (workspaceId, clientId) =>
      Effect.sync(() => {
        const index = state.applications.findIndex(
          (kept) =>
            kept.workspaceId === workspaceId && kept.clientId === clientId
        );

        if (index !== -1) {
          state.applications.splice(index, 1);
        }
      }),
    unsentOf: (channelId) =>
      Effect.sync(() =>
        [...state.outgoing.values()].filter(
          (message) =>
            message.channelId === channelId &&
            message.status._tag === "sending" &&
            // Its call never claimed: the fake gate claims as it calls.
            ![...state.sent, ...state.resumed].some(
              (request) => request.messageId === message.id
            )
        )
      ),
    switchedOn: (workspaceId) =>
      Effect.sync(() =>
        [...state.switchedOn.values()].filter(
          (on) => on.workspaceId === workspaceId
        )
      ),
    switchOn: (on, box) =>
      Effect.sync(() => {
        if (!state.switchedOn.has(on.channelId)) {
          state.switchedOn.set(on.channelId, on);
        }

        if (!state.boxes.has(box.channelId)) {
          state.boxes.set(box.channelId, box);
        }
      }),
    advanceMessage: (next, from) =>
      Effect.sync(() => {
        const current = state.outgoing.get(from.id);

        if (
          current === undefined ||
          JSON.stringify(current.status) !== JSON.stringify(from.status)
        ) {
          return false;
        }

        state.outgoing.set(next.id, next);

        return true;
      }),
    box: (channelId) =>
      Effect.sync(() => Option.fromUndefinedOr(state.boxes.get(channelId))),
    bringForward: (channelId, at) =>
      Effect.sync(() => {
        const box = state.boxes.get(channelId);

        if (box === undefined) {
          return false;
        }

        // Never before the box's hold, as the Postgres store.
        const earliest = Option.match(box.notBefore, {
          onNone: () => at,
          onSome: (until) => (millis(until) > millis(at) ? until : at),
        });

        if (millis(earliest) < millis(box.nextReadAt)) {
          state.boxes.set(channelId, boxWith(box, { nextReadAt: earliest }));
        }

        return true;
      }),
    deleteTakenBack: (channelId, platformMessageId) =>
      Effect.sync(() => {
        let gone = 0;

        for (const [key, message] of state.messages) {
          if (
            message.channelId === channelId &&
            message.platformMessageId === platformMessageId
          ) {
            state.messages.delete(key);
            gone += 1;
          }
        }

        return gone;
      }),
    refollow: (channelIds) =>
      Effect.sync(() => {
        for (const channelId of channelIds) {
          const box = state.boxes.get(channelId);

          if (box !== undefined) {
            state.boxes.set(
              channelId,
              boxWith(box, { subscribedAt: Option.none() })
            );
          }
        }
      }),
    markFollowed: (channelId, at) =>
      Effect.sync(() => {
        const box = state.boxes.get(channelId);

        if (box !== undefined) {
          state.boxes.set(
            channelId,
            boxWith(box, { subscribedAt: Option.some(at) })
          );
        }
      }),
    channelGone: (channelId) => Effect.sync(() => channelGone(channelId)),
    claimCall: (messageId) =>
      Effect.sync(
        () => state.outgoing.get(messageId)?.status._tag === "sending"
      ),
    conversation: (conversationId) =>
      Effect.sync(() =>
        Option.fromUndefinedOr(state.conversations.get(conversationId)).pipe(
          Option.map(summaryOf)
        )
      ),
    conversationsOf: (channelId) =>
      Effect.sync(() =>
        [...state.conversations.values()].filter(
          (conversation) => conversation.channelId === channelId
        )
      ),
    countDue: (at) =>
      Effect.sync(
        () =>
          [...state.boxes.values()].filter(
            (box) => millis(box.nextReadAt) <= millis(at)
          ).length
      ),
    deleteMessages: (messageIds) =>
      Effect.sync(() => {
        for (const id of messageIds) {
          state.messages.delete(id);
        }
      }),
    due: (at, limit) =>
      Effect.sync(() =>
        [...state.boxes.values()]
          .filter((box) => millis(box.nextReadAt) <= millis(at))
          .toSorted(
            (left, right) => millis(left.nextReadAt) - millis(right.nextReadAt)
          )
          .slice(0, limit)
      ),
    follow: (boxes) =>
      Effect.sync(() => {
        let followed = 0;

        for (const box of boxes) {
          if (!state.boxes.has(box.channelId)) {
            state.boxes.set(box.channelId, box);
            followed += 1;
          }
        }

        return followed;
      }),
    madeWithKey: (message, key) =>
      Effect.sync(() => {
        const made = state.keys.get(`${message.workspaceId}:${key.key}`);

        const earlier =
          made === undefined ? undefined : state.outgoing.get(made);

        if (
          earlier === undefined ||
          !DateTime.isGreaterThan(earlier.createdAt, key.since)
        ) {
          return Option.none<MessageJournalled>();
        }

        return Option.some<MessageJournalled>(
          earlier.conversationId === message.conversationId &&
            earlier.text === message.text
            ? { _tag: "replayed", message: earlier }
            : { _tag: "keyReused" }
        );
      }),
    journalMessage: (message, key) =>
      Effect.sync((): MessageJournalled => {
        if (Option.isSome(key)) {
          const made = state.keys.get(
            `${message.workspaceId}:${key.value.key}`
          );

          const earlier =
            made === undefined ? undefined : state.outgoing.get(made);

          if (earlier !== undefined) {
            return earlier.conversationId === message.conversationId &&
              earlier.text === message.text
              ? { _tag: "replayed", message: earlier }
              : { _tag: "keyReused" };
          }
        }

        if (!state.conversations.has(message.conversationId)) {
          return { _tag: "dropped" };
        }

        const waiting = pending(message.conversationId);

        if (waiting !== undefined) {
          return { _tag: "pending", messageId: waiting.id };
        }

        state.outgoing.set(message.id, message);

        if (Option.isSome(key)) {
          state.keys.set(`${message.workspaceId}:${key.value.key}`, message.id);
        }

        return { _tag: "journalled" };
      }),
    listConversations: (workspaceId, filter, page) =>
      Effect.sync(() =>
        [...state.conversations.values()]
          .filter(
            (conversation) =>
              conversation.workspaceId === workspaceId &&
              Option.match(filter.channelId, {
                onNone: () => true,
                onSome: (channelId) => conversation.channelId === channelId,
              }) &&
              (!filter.unread || isUnread(conversation))
          )
          .toSorted(
            (left, right) =>
              millis(right.lastMessageAt) - millis(left.lastMessageAt) ||
              right.id.localeCompare(left.id)
          )
          .filter((conversation) =>
            Option.match(page.after, {
              onNone: () => true,
              onSome: (cursor) =>
                millis(conversation.lastMessageAt) <
                  millis(cursor.lastMessageAt) ||
                (millis(conversation.lastMessageAt) ===
                  millis(cursor.lastMessageAt) &&
                  conversation.id < cursor.conversationId),
            })
          )
          .slice(0, page.limit)
          .map(summaryOf)
      ),
    lockBox: () => Effect.void,
    messagesOf: (conversationId) =>
      Effect.sync(() =>
        [...state.messages.values()]
          .filter((message) => message.conversationId === conversationId)
          .toSorted((left, right) => millis(left.sentAt) - millis(right.sentAt))
      ),
    outgoing: (messageId) =>
      Effect.sync(() => Option.fromUndefinedOr(state.outgoing.get(messageId))),
    outgoingOf: (conversationId) =>
      Effect.sync(() =>
        [...state.outgoing.values()]
          .filter((message) => message.conversationId === conversationId)
          .toSorted((left, right) => left.id.localeCompare(right.id))
      ),
    purge: (keptSince, limit) =>
      Effect.sync(() => {
        const old = [...state.messages.values()]
          .filter((message) => millis(message.sentAt) < millis(keptSince))
          .slice(0, limit);

        for (const message of old) {
          state.messages.delete(message.id);
        }

        // Settled (sent, failed or left unconfirmed) as long ago as Peal
        // keeps a message.
        for (const [key, message] of state.outgoing) {
          if (
            message.status._tag !== "sending" &&
            millis(message.status.at) < millis(keptSince)
          ) {
            state.outgoing.delete(key);
          }
        }

        const gone = [...state.conversations.values()]
          .filter(
            (conversation) =>
              millis(conversation.lastMessageAt) < millis(keptSince) &&
              pending(conversation.id) === undefined
          )
          .slice(0, limit);

        for (const conversation of gone) {
          dropConversation(conversation.id);
        }

        return { conversations: gone.length, messages: old.length };
      }),
    // The schedule only, as the Postgres store saves it.
    saveBox: (box) =>
      Effect.sync(() => {
        const kept = state.boxes.get(box.channelId);

        if (kept !== undefined) {
          state.boxes.set(
            box.channelId,
            boxWith(box, { subscribedAt: kept.subscribedAt })
          );
        }
      }),
    saveConversations: (saved) =>
      Effect.sync(() => {
        const fresh: Conversation[] = [];

        for (const conversation of saved) {
          if (state.conversations.has(conversation.id)) {
            state.conversations.set(conversation.id, conversation);
          } else if (
            ![...state.conversations.values()].some(
              (kept) =>
                kept.channelId === conversation.channelId &&
                kept.platformConversationId ===
                  conversation.platformConversationId
            )
          ) {
            state.conversations.set(conversation.id, conversation);
            fresh.push(conversation);
          }
        }

        return fresh;
      }),
    saveMessages: (saved) =>
      Effect.sync(() => {
        const fresh: DirectMessage[] = [];

        for (const message of saved) {
          if (state.messages.has(message.id)) {
            state.messages.set(message.id, message);
          } else if (
            ![...state.messages.values()].some(
              (kept) =>
                kept.conversationId === message.conversationId &&
                kept.platformMessageId === message.platformMessageId
            )
          ) {
            state.messages.set(message.id, message);
            fresh.push(message);
          }
        }

        return fresh;
      }),
    handOver: (messageId, at) =>
      Effect.sync(() => {
        const message = state.outgoing.get(messageId);

        if (message === undefined || message.status._tag !== "sending") {
          return Option.none<OutgoingMessage>();
        }

        const handed = Result.getOrThrow(
          settleMessage(
            message,
            { _tag: "unconfirmed", reason: "interrupted" },
            at
          )
        );

        state.outgoing.set(messageId, handed);

        return Option.some(handed);
      }),
    strandedMessages: (writtenBefore, _calledBefore, limit) =>
      Effect.sync(() =>
        [...state.outgoing.values()]
          .filter(
            (message) =>
              message.status._tag === "sending" &&
              millis(message.createdAt) <= millis(writtenBefore)
          )
          .slice(0, limit)
      ),
  });

  const ports = Layer.mergeAll(
    Layer.succeed(MessageStore, store),
    Layer.succeed(PrivateReplyStore, noPrivateReplies),
    Layer.succeed(
      MessageSource,
      MessageSource.of({
        follow: (request) => {
          state.follows.push(request.channelId);

          return state.following(request);
        },
        read: (request) => {
          state.reads.push(request);

          return state.read(request);
        },
        unfollow: (request) => {
          state.unfollows.push(request.channelId);

          return state.following(request);
        },
      })
    ),
    Layer.succeed(
      MessageSender,
      MessageSender.of({
        resume: (request) =>
          Effect.sync(() => {
            state.resumed.push(request);

            return state.resuming;
          }),
        send: (request) =>
          Effect.sync(() => {
            state.sent.push(request);

            return state.sending;
          }),
      })
    ),
    Layer.succeed(
      MessageJobs,
      MessageJobs.of({
        cancel: (messageId) =>
          Effect.sync(() => {
            state.cancelled.push(messageId);
          }),
        readBox: (channelId, slot) =>
          Effect.sync(() => {
            const started = { channelId, slot: DateTime.formatIso(slot) };

            if (
              !state.boxReads.some(
                (read) =>
                  read.channelId === started.channelId &&
                  read.slot === started.slot
              )
            ) {
              state.boxReads.push(started);
            }
          }),
        start: (messageId) =>
          Effect.sync(() => {
            state.jobs.push(messageId);
          }),
      })
    ),
    Layer.succeed(
      MessageOutcomes,
      MessageOutcomes.of({
        received: (conversation, received) =>
          Effect.sync(() => {
            state.received.push({ conversation, messages: received });
          }),
        settled: (_conversation, message) =>
          Effect.sync(() => {
            state.settled.push(message);
          }),
        turnedOff: (box) =>
          Effect.sync(() => {
            state.turnedOff.push({
              channelId: box.channelId,
              workspaceId: box.workspaceId,
            });
          }),
      })
    ),
    Layer.succeed(
      EngagementChannels,
      EngagementChannels.of({
        belongs: () => Effect.succeed(true),
        describe: (channelId) =>
          Option.match(Option.fromUndefinedOr(state.channels.get(channelId)), {
            onNone: () =>
              Effect.fail(new ChannelUnreadable({ reason: "disconnected" })),
            onSome: (channel) => Effect.succeed(channel),
          }),
      })
    ),
    Layer.succeed(
      ReplyLimits,
      ReplyLimits.of({
        // Mastodon's 500 characters, as publishing counts them.
        overflow: (_platform, text) =>
          Effect.succeed(
            text.length > 500
              ? Option.some({
                  length: text.length,
                  maximum: 500,
                  unit: "characters",
                })
              : Option.none()
          ),
      })
    ),
    Layer.succeed(
      TransactionRunner,
      TransactionRunner.of({ transaction: (effect) => effect })
    ),
    Layer.succeed(
      MessageChannelsOfAccount,
      MessageChannelsOfAccount.of({
        channelsOf: (platform, accountId) =>
          Effect.sync(() => [
            ...(state.accounts.get(`${platform}:${accountId}`) ?? []),
          ]),
      })
    ),
    Layer.succeed(CurrentInboxMessages, messages),
    Ids.layerTest,
    meters
  );

  const layer = Layer.mergeAll(
    EngagementMessages.layer,
    MessageSettings.layer,
    CollectMessages.layer.pipe(Layer.provideMerge(SendMessage.layer)),
    PurgeMessages.layer,
    ReceiveMessageEvents.layer
  ).pipe(Layer.provideMerge(ports));

  return { layer, state, store };
};

export type MessageWorld = ReturnType<typeof makeMessageWorld>;
