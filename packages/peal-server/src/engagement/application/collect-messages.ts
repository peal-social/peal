import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Metric,
  Option,
  Result,
} from "effect";

import { ConversationIdSchema } from "#engagement/domain/conversation-id.ts";
import {
  conversationsKeptSince,
  isConversationKept,
  refreshConversation,
  startConversation,
} from "#engagement/domain/conversation.ts";
import type {
  Conversation,
  ConversationReading,
} from "#engagement/domain/conversation.ts";
import { DirectMessageIdSchema } from "#engagement/domain/direct-message-id.ts";
import {
  receiveMessage,
  reconcileMessages,
} from "#engagement/domain/direct-message.ts";
import {
  heldAt,
  postponeBoxRead,
  recordBoxRead,
  subscriptionDue,
  MessageBox,
} from "#engagement/domain/message-box.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { Ids, newId } from "#shared/application/ids.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { ChannelId } from "#shared/domain/ids.ts";

import { forgetChannelMessages } from "./forget-channel-messages.ts";
import { MessageOutcomes } from "./ports/message-outcomes.ts";
import { MessageSource } from "./ports/message-source.ts";
import type {
  MessagesBatch,
  MessagesReadFailure,
} from "./ports/message-source.ts";
import { MessageStore } from "./ports/message-store.ts";
import { SendMessage } from "./send-message.ts";

/** What a run of the messages' collection did. */
export interface MessagesReport {
  /** Channels whose conversations were read. */
  readonly read: number;
  /** Channels put off: paused, gone, or their platform down. */
  readonly deferred: number;
  /** Messages no job settled, handed to a person. */
  readonly stranded: number;
  /** Channels still due when the run ended. */
  readonly left: number;
}

/** How a run of the messages' collection is paced. */
export interface MessagesPace {
  /** How long after its scheduled time a run starts no more reads. */
  readonly budget: Duration.Duration;
  /** Channels read at the same time, each through its gate. */
  readonly concurrency: number;
  /** Channels listed, and boxes taken from the store, at a time. */
  readonly pageSize: number;
}

/**
 * The pace of the messages' collection: 8 channels at a time, pages of
 * 500, for 8 minutes of each run every ten.
 */
export const MessagesPaceRef = Context.Reference<MessagesPace>(
  "peal-server/engagement/application/MessagesPace",
  {
    defaultValue: () => ({
      budget: Duration.minutes(8),
      concurrency: 8,
      pageSize: 500,
    }),
  }
);

/** How long a channel waits after a read its platform did not answer. */
export const messagesRetryAfter = Duration.minutes(30);

/** How long a channel waits while it cannot be read. */
export const messagesPausedFor = Duration.hours(6);

/** Channels still due when the last run ended: 0 while runs finish. */
export const messagesLeft = Metric.gauge("peal.engagement.messages.left", {
  description:
    "Channels whose direct messages were still due when the last run ended",
});

/** Runs that stopped at their budget with channels still due. */
export const messagesUnfinished = Metric.counter(
  "peal.engagement.messages.unfinished",
  {
    description:
      "Direct messages collection runs that could not finish in their budget",
    incremental: true,
  }
);

/** Channels whose read the database refused, or a fault broke. */
export const messagesBoxFailures = Metric.counter(
  "peal.engagement.messages.box_failures",
  {
    description:
      "Channels whose direct messages could not be recorded, put off to a later run",
    incremental: true,
  }
);

const emptyReport: MessagesReport = {
  deferred: 0,
  left: 0,
  read: 0,
  stranded: 0,
};

// What one channel's turn came to.
type Turn = "deferred" | "read" | "unreached";

/**
 * What reading one box now came to: read, put off (the platform did not
 * answer, or the channel cannot be read), `missing` when the channel has
 * no box (its messages are off), `off` where the server reads no messages.
 */
export type BoxReadOutcome = "deferred" | "missing" | "off" | "read";

/**
 * Reads the direct messages of every channel on a platform the operator
 * turned on (`PEAL_INBOX_MESSAGES`): off, it follows nothing and calls
 * nothing, and a channel is read only once its workspace turned its
 * messages on (`switchOn`, which follows its box). A run hands the
 * messages no job settled to a person, then reads the boxes due, the ones
 * that waited longest first, each through its channel's gate: the
 * conversations new or changed since the last read, back to the oldest
 * message Peal may keep (`conversationsKeptFor`). What a read changes and
 * what the workspace is told are saved in one transaction, under the
 * channel's lock.
 */
export class CollectMessages extends Context.Service<
  CollectMessages,
  {
    readonly run: (
      at: DateTime.Utc
    ) => Effect.Effect<MessagesReport, DatabaseError>;
    /**
     * Reads one channel's box now, as a run reads a box due: what its
     * platform's event asked for.
     */
    readonly readBox: (
      channelId: ChannelId,
      at: DateTime.Utc
    ) => Effect.Effect<BoxReadOutcome, DatabaseError>;
  }
>()("peal-server/engagement/application/CollectMessages") {
  static readonly layer = Layer.effect(
    CollectMessages,
    Effect.gen(function* CollectMessagesLive() {
      const store = yield* MessageStore;
      const source = yield* MessageSource;
      const outcomes = yield* MessageOutcomes;
      const sending = yield* SendMessage;
      const messages = yield* CurrentInboxMessages;
      const pace = yield* MessagesPaceRef;
      const { transaction } = yield* TransactionRunner;
      const ids = yield* Ids;
      const meters = yield* MeteredUsage;

      // One conversation as the read found it: kept, its messages
      // reconciled, and the messages others sent since the channel was
      // followed told.
      const recordConversation = Effect.fn(
        "CollectMessages.recordConversation"
      )(function* recordConversation(
        box: MessageBox,
        kept: Option.Option<Conversation>,
        reading: ConversationReading,
        keptSince: DateTime.Utc,
        now: DateTime.Utc
      ) {
        const started = Option.isNone(kept);

        const conversation = Option.isSome(kept)
          ? kept.value
          : startConversation(
              yield* newId(ConversationIdSchema).pipe(
                Effect.provideService(Ids, ids)
              ),
              box,
              reading,
              now
            );

        if (started) {
          const saved = yield* store.saveConversations([conversation]);

          // Another read kept it first, under its own id: it is that one's.
          if (saved.length === 0) {
            return;
          }
        }

        const before = yield* store.messagesOf(conversation.id);

        const changes = reconcileMessages(
          before,
          reading.messages,
          reading.deleted,
          reading.complete,
          keptSince
        );

        const fresh = yield* Effect.all(
          changes.fresh.map((message) =>
            newId(DirectMessageIdSchema).pipe(
              Effect.provideService(Ids, ids),
              Effect.map((id) => receiveMessage(id, conversation, message, now))
            )
          )
        );

        const received = yield* store.saveMessages([
          ...changes.refreshed,
          ...fresh,
        ]);

        yield* store.deleteMessages(changes.gone);

        const after = yield* store.messagesOf(conversation.id);

        yield* store.saveConversations([
          refreshConversation(conversation, reading, after, now),
        ]);

        const told = received.filter(
          (message) =>
            !message.fromAccount &&
            DateTime.isGreaterThanOrEqualTo(message.sentAt, box.createdAt)
        );

        if (told.length > 0) {
          yield* outcomes.received(conversation, told);
        }
      });

      // Saves what a read found, under the channel's lock: a channel that
      // left meanwhile is gone, and nothing is kept.
      const record = Effect.fn("CollectMessages.record")(function* record(
        box: MessageBox,
        batch: MessagesBatch,
        at: DateTime.Utc
      ) {
        yield* store.lockBox(box.channelId);

        const current = yield* store.box(box.channelId);

        if (Option.isNone(current)) {
          return;
        }

        const now = yield* DateTime.now;
        const keptSince = conversationsKeptSince(now);
        const known = yield* store.conversationsOf(box.channelId);

        const byPlatformId = new Map(
          known.map((conversation) => [
            conversation.platformConversationId,
            conversation,
          ])
        );

        for (const reading of batch.conversations) {
          if (isConversationKept(reading.lastMessageAt, now)) {
            yield* recordConversation(
              current.value,
              Option.fromUndefinedOr(
                byPlatformId.get(reading.platformConversationId)
              ),
              reading,
              keptSince,
              now
            );
          }
        }

        let latest = Option.none<DateTime.Utc>();

        for (const { lastMessageAt } of yield* store.conversationsOf(
          box.channelId
        )) {
          if (
            !Option.exists(latest, (found) =>
              DateTime.isGreaterThanOrEqualTo(found, lastMessageAt)
            )
          ) {
            latest = Option.some(lastMessageAt);
          }
        }

        // A listing that showed every conversation the platform has, back
        // to what Peal keeps, no longer shows those deleted there; an empty
        // one says nothing, as a platform that answers none may be wrong.
        // One that stopped short still saw those it shows.
        yield* batch.listedWhole && batch.listed.length > 0
          ? store.dropUnlisted(box.channelId, batch.listed, now)
          : store.clearUnlisted(box.channelId, batch.listed);

        // A read that halted is read again at the next run, from the
        // conversations it did not reach, which have not changed for Peal.
        // An event that moved the box's next read while it read keeps
        // that earlier read: what it told of may not be in this one.
        const read = recordBoxRead(current.value, latest, now, at);

        const movedMeanwhile = !DateTime.Equivalence(
          current.value.nextReadAt,
          box.nextReadAt
        );

        yield* store.saveBox(
          movedMeanwhile &&
            DateTime.isLessThan(current.value.nextReadAt, read.nextReadAt)
            ? new MessageBox({
                channelId: read.channelId,
                createdAt: read.createdAt,
                lastReadAt: read.lastReadAt,
                nextReadAt: current.value.nextReadAt,
                notBefore: read.notBefore,
                subscribedAt: read.subscribedAt,
                workspaceId: read.workspaceId,
              })
            : read
        );
      });

      // A channel that left goes now, with what it held, as do the messages
      // of one whose account no longer grants them; one that cannot be read
      // waits.
      const putOff = (
        box: MessageBox,
        failure: MessagesReadFailure,
        at: DateTime.Utc
      ) => {
        if (failure._tag === "RateLimited") {
          return store.saveBox(
            postponeBoxRead(
              box,
              at,
              Duration.max(
                failure.retryAfter ?? messagesRetryAfter,
                messagesRetryAfter
              )
            )
          );
        }

        if (
          failure._tag === "ChannelUnreadable" &&
          failure.reason === "disconnected"
        ) {
          return transaction(
            forgetChannelMessages(store, meters, box.channelId)
          );
        }

        // Its account was signed in again without what reading takes: its
        // messages are turned off, never left on unread, and members told.
        if (failure._tag === "MessagesUngranted") {
          return transaction(
            forgetChannelMessages(store, meters, box.channelId).pipe(
              Effect.andThen(outcomes.turnedOff(box))
            )
          );
        }

        return store.saveBox(
          postponeBoxRead(
            box,
            at,
            failure._tag === "PlatformUnavailable"
              ? messagesRetryAfter
              : messagesPausedFor
          )
        );
      };

      // Asks the box's platform to tell the server of the account's
      // messages, as one may drop the subscription (Meta, after an hour of
      // failed deliveries): before the first read, then once a day. A
      // refusal is logged by the channel's id and changes nothing else, as
      // the box is read on its schedule all the same.
      const followIfDue = (box: MessageBox) =>
        Effect.gen(function* following() {
          const now = yield* DateTime.now;

          if (!subscriptionDue(box, now)) {
            return;
          }

          const followed = yield* source
            .follow({ channelId: box.channelId })
            .pipe(Effect.result);

          yield* Result.isSuccess(followed)
            ? store.markFollowed(box.channelId, now)
            : Effect.logWarning(
                "Could not ask a platform for a channel's message events"
              ).pipe(
                Effect.annotateLogs({
                  channelId: box.channelId,
                  reason: followed.failure._tag,
                })
              );
        });

      const readOne = (
        box: MessageBox,
        at: DateTime.Utc,
        deadline: DateTime.Utc
      ): Effect.Effect<Turn, DatabaseError> =>
        Effect.gen(function* reading() {
          if (DateTime.isGreaterThanOrEqualTo(yield* DateTime.now, deadline)) {
            return "unreached" as const;
          }

          yield* followIfDue(box);

          const read = yield* source
            .read({
              channelId: box.channelId,
              keptSince: conversationsKeptSince(at),
            })
            .pipe(Effect.result);

          if (Result.isFailure(read)) {
            yield* putOff(box, read.failure, at);

            return "deferred" as const;
          }

          // One channel never stops a run: one the database refuses, or a
          // fault breaks on, is put off, counted and logged by its id
          // alone, as the failure may quote what people wrote.
          const putOffFailed = Metric.update(messagesBoxFailures, 1).pipe(
            Effect.andThen(
              Effect.logWarning("Could not record a channel's direct messages")
            ),
            Effect.annotateLogs({ channelId: box.channelId }),
            Effect.andThen(
              store.saveBox(postponeBoxRead(box, at, messagesRetryAfter))
            ),
            Effect.as("deferred" as const)
          );

          return yield* transaction(record(box, read.success, at)).pipe(
            Effect.as("read" as const),
            Effect.catchTag("DatabaseError", () => putOffFailed),
            Effect.catchDefect(() => putOffFailed)
          );
        });

      const run = Effect.fn("CollectMessages.run")(function* run(
        at: DateTime.Utc
      ) {
        // Off, nothing is followed and nothing is called.
        if (messages.size === 0) {
          return emptyReport;
        }

        const stranded = yield* sending.settleStranded;
        const deadline = DateTime.addDuration(at, pace.budget);
        let read = 0;
        let deferred = 0;

        for (;;) {
          const due = yield* store.due(at, pace.pageSize);

          const turns = yield* Effect.forEach(
            due,
            (box) => readOne(box, at, deadline),
            { concurrency: pace.concurrency }
          );

          read += turns.filter((turn) => turn === "read").length;
          deferred += turns.filter((turn) => turn === "deferred").length;

          if (
            due.length < pace.pageSize ||
            turns.includes("unreached") ||
            turns.length === 0
          ) {
            break;
          }
        }

        const left = yield* store.countDue(at);

        yield* Metric.update(messagesLeft, left);

        if (left > 0) {
          yield* Metric.update(messagesUnfinished, 1);
        }

        const report: MessagesReport = {
          deferred,
          left,
          read,
          stranded,
        };

        return report;
      });

      const readBox = Effect.fn("CollectMessages.readBox")(function* readBox(
        channelId: ChannelId,
        at: DateTime.Utc
      ) {
        if (messages.size === 0) {
          return "off" as const;
        }

        const box = yield* store.box(channelId);

        if (Option.isNone(box)) {
          return "missing" as const;
        }

        // The platform asked to wait, or the channel could not be read: an
        // event does not cut that short.
        if (heldAt(box.value, yield* DateTime.now)) {
          return "deferred" as const;
        }

        const turn = yield* readOne(
          box.value,
          at,
          DateTime.addDuration(at, pace.budget)
        );

        return turn === "read" ? ("read" as const) : ("deferred" as const);
      });

      return CollectMessages.of({ readBox, run });
    })
  );
}
