import { setTimeout as delay } from "node:timers/promises";

import { assert, layer } from "@effect/vitest";
import {
  DateTime,
  Deferred,
  Duration,
  Effect,
  Fiber,
  Layer,
  Option,
  Ref,
  Result,
} from "effect";
import { SqlClient } from "effect/sql";

import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import { forgetChannelMessages } from "#engagement/application/forget-channel-messages.ts";
import { CommentRuleNotices } from "#engagement/application/ports/comment-rule-notices.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";
import { ConversationIdSchema } from "#engagement/domain/conversation-id.ts";
import {
  markConversationRead,
  refreshConversation,
  startConversation,
} from "#engagement/domain/conversation.ts";
import type {
  Conversation,
  ConversationReading,
} from "#engagement/domain/conversation.ts";
import { DirectMessageIdSchema } from "#engagement/domain/direct-message-id.ts";
import { receiveMessage } from "#engagement/domain/direct-message.ts";
import type { MessageReading } from "#engagement/domain/direct-message.ts";
import {
  followBox,
  postponeBoxRead,
  recordBoxRead,
} from "#engagement/domain/message-box.ts";
import type { MessageBox } from "#engagement/domain/message-box.ts";
import { OutgoingMessageIdSchema } from "#engagement/domain/outgoing-message-id.ts";
import {
  beginMessage,
  settleMessage,
  writeMessage,
} from "#engagement/domain/outgoing-message.ts";
import { DrizzleEngagementRecords } from "#engagement/infrastructure/drizzle-engagement-records.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { DrizzlePrivateReplyStore } from "#engagement/infrastructure/drizzle-private-reply-store.ts";
import { newId } from "#shared/application/ids.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { ChannelIdSchema, UserIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { DatabaseTest, freshWorkspace } from "#test/channels/support.ts";
import {
  conversationReading,
  messageReading,
} from "#test/engagement/support.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";

// The Postgres store of direct messages, on the database DATABASE_URL
// names. Each test writes rows of its own workspace, at instants no other
// suite uses (2049; the retention in 1935), and deletes them after.

// The records give back the outbound message of what never set out, on
// meters that count in memory.
const StoreTest = Layer.mergeAll(
  DrizzleMessageStore,
  DrizzlePrivateReplyStore,
  DrizzleEngagementRecords.pipe(Layer.provide(CommentRuleNotices.none))
).pipe(
  Layer.provideMerge(fakeMeters({ allowed: Option.none() })),
  Layer.provideMerge(DatabaseTest)
);

// Whether a transaction waits for a lock on engagement's tables.
const waitingOnEngagement = SqlClient.SqlClient.use(
  (sql) =>
    sql<{
      waiting: number;
    }>`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%engagement%'`
).pipe(
  Effect.map((rows) => (rows[0]?.waiting ?? 0) > 0),
  Effect.orDie
);

// A moment of real time: the database works on its own clock.
const pause = Effect.promise(async () => {
  await delay(20);
});

// What the meters were given back for the workspace.
const givenBackIn = (workspaceId: WorkspaceId) =>
  FakeMetersLedger.use(Ref.get).pipe(
    Effect.map(({ givenBack }) =>
      givenBack.filter((claim) => claim.workspaceId === workspaceId)
    )
  );

const utc = (iso: string) => DateTime.makeUnsafe(iso);

const forget = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use((sql) =>
    Effect.all([
      sql`DELETE FROM engagement.conversations WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_applications WHERE workspace_id = ${workspaceId}`,
    ])
  ).pipe(Effect.orDie);

const boxOf = Effect.fn("boxOf")(function* boxOf(
  workspaceId: WorkspaceId,
  at: string
) {
  return followBox(
    { channelId: yield* newId(ChannelIdSchema), workspaceId },
    utc(at)
  );
});

const conversationOn = Effect.fn("conversationOn")(function* conversationOn(
  box: MessageBox,
  n: number,
  at: string,
  changed: Partial<ConversationReading> = {}
) {
  return startConversation(
    yield* newId(ConversationIdSchema),
    box,
    conversationReading(n, { lastMessageAt: utc(at), ...changed }),
    utc(at)
  );
});

const messageOn = Effect.fn("messageOn")(function* messageOn(
  conversation: Conversation,
  n: number,
  at: string,
  changed: Partial<MessageReading> = {}
) {
  return receiveMessage(
    yield* newId(DirectMessageIdSchema),
    conversation,
    messageReading(n, { sentAt: utc(at), ...changed }),
    utc(at)
  );
});

layer(StoreTest)("the message store", (it) => {
  it.effect("follows a channel once, and reads it when due", () =>
    Effect.gen(function* follows() {
      const workspaceId = yield* freshWorkspace;
      const store = yield* MessageStore;
      const box = yield* boxOf(workspaceId, "2049-02-01T10:00:00.000Z");

      yield* Effect.gen(function* checks() {
        assert.strictEqual(yield* store.follow([box]), 1);
        assert.strictEqual(yield* store.follow([box]), 0);

        const due = yield* store.due(utc("2049-02-01T10:00:00.000Z"), 1000);

        assert.deepStrictEqual(
          due.filter(({ channelId }) => channelId === box.channelId),
          [box]
        );

        const read = recordBoxRead(
          box,
          Option.none(),
          utc("2049-02-01T10:01:00.000Z"),
          utc("2049-02-01T10:00:00.000Z")
        );

        yield* store.saveBox(read);

        assert.deepStrictEqual(
          yield* store.box(box.channelId),
          Option.some(read)
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect(
    "keeps a conversation and its messages once, and lists it unread",
    () =>
      Effect.gen(function* keeps() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-02T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const started = yield* conversationOn(
            box,
            1,
            "2049-02-02T09:00:00.000Z"
          );

          assert.deepStrictEqual(yield* store.saveConversations([started]), [
            started,
          ]);

          // The same conversation read again under another id is passed over.
          const twin = yield* conversationOn(
            box,
            1,
            "2049-02-02T09:00:00.000Z"
          );

          assert.deepStrictEqual(yield* store.saveConversations([twin]), []);

          const first = yield* messageOn(
            started,
            1,
            "2049-02-02T09:00:00.000Z"
          );

          const own = yield* messageOn(started, 2, "2049-02-02T09:05:00.000Z", {
            fromAccount: true,
            senderPlatformId: Option.none(),
          });

          assert.deepStrictEqual(yield* store.saveMessages([first, own]), [
            first,
            own,
          ]);
          assert.deepStrictEqual(
            yield* store.saveMessages([
              yield* messageOn(started, 1, "2049-02-02T09:00:00.000Z"),
            ]),
            []
          );

          const refreshed = refreshConversation(
            started,
            conversationReading(1, {
              lastMessageAt: utc("2049-02-02T09:05:00.000Z"),
              revision: "r2",
            }),
            [first, own],
            utc("2049-02-02T09:06:00.000Z")
          );

          yield* store.saveConversations([refreshed]);

          const summary = yield* store.conversation(started.id);

          assert.deepStrictEqual(
            summary,
            Option.some({ conversation: refreshed, messages: 2 })
          );
          assert.deepStrictEqual(yield* store.messagesOf(started.id), [
            first,
            own,
          ]);

          const unread = yield* store.listConversations(
            workspaceId,
            { channelId: Option.none(), unread: true },
            { after: Option.none(), limit: 10 }
          );

          assert.deepStrictEqual(
            unread.map(({ conversation }) => conversation.id),
            [started.id]
          );

          yield* store.saveConversations([
            markConversationRead(
              refreshed,
              true,
              utc("2049-02-02T09:10:00.000Z")
            ),
          ]);

          assert.deepStrictEqual(
            yield* store.listConversations(
              workspaceId,
              { channelId: Option.none(), unread: true },
              { after: Option.none(), limit: 10 }
            ),
            []
          );

          yield* store.deleteMessages([first.id]);

          assert.deepStrictEqual(yield* store.messagesOf(started.id), [own]);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect("pages a workspace's conversations, latest message first", () =>
    Effect.gen(function* pages() {
      const workspaceId = yield* freshWorkspace;
      const store = yield* MessageStore;
      const box = yield* boxOf(workspaceId, "2049-02-03T10:00:00.000Z");

      yield* Effect.gen(function* checks() {
        yield* store.follow([box]);

        const older = yield* conversationOn(box, 1, "2049-02-03T08:00:00.000Z");
        const newer = yield* conversationOn(box, 2, "2049-02-03T09:00:00.000Z");

        yield* store.saveConversations([older, newer]);

        const first = yield* store.listConversations(
          workspaceId,
          { channelId: Option.some(box.channelId), unread: false },
          { after: Option.none(), limit: 1 }
        );

        assert.deepStrictEqual(
          first.map(({ conversation }) => conversation.id),
          [newer.id]
        );

        const second = yield* store.listConversations(
          workspaceId,
          { channelId: Option.none(), unread: false },
          {
            after: Option.some({
              conversationId: newer.id,
              lastMessageAt: newer.lastMessageAt,
            }),
            limit: 10,
          }
        );

        assert.deepStrictEqual(
          second.map(({ conversation }) => conversation.id),
          [older.id]
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect(
    "journals one message on its way a conversation, and one a key",
    () =>
      Effect.gen(function* journals() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-04T10:00:00.000Z");
        const at = utc("2049-02-04T10:00:00.000Z");
        const since = DateTime.subtractDuration(at, "24 hours");

        const authorId = UserIdSchema.make(
          "22222222-2222-4222-8222-222222222222"
        );

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "2049-02-04T09:00:00.000Z"
          );

          yield* store.saveConversations([talk]);

          const message = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.some(authorId),
            "Thanks!",
            at
          );

          const key = Option.some({ key: "synthetic-key-1", since });

          assert.deepStrictEqual(yield* store.journalMessage(message, key), {
            _tag: "journalled",
          });

          // Sent again with its key: the same message, none other.
          const again = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.some(authorId),
            "Thanks!",
            at
          );

          assert.deepStrictEqual(yield* store.journalMessage(again, key), {
            _tag: "replayed",
            message,
          });

          const otherText = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.some(authorId),
            "Another",
            at
          );

          assert.deepStrictEqual(yield* store.journalMessage(otherText, key), {
            _tag: "keyReused",
          });
          assert.deepStrictEqual(
            yield* store.journalMessage(otherText, Option.none()),
            { _tag: "pending", messageId: message.id }
          );

          // Settled, the conversation takes the next.
          const begun = Result.getOrThrow(beginMessage(message, at));

          assert.isTrue(yield* store.advanceMessage(begun, message));
          assert.isFalse(yield* store.advanceMessage(begun, message));
          assert.isTrue(yield* store.claimCall(message.id, at));

          const sent = Result.getOrThrow(
            settleMessage(begun, { _tag: "sent", platformMessageId: "m9" }, at)
          );

          assert.isTrue(yield* store.advanceMessage(sent, begun));
          assert.isFalse(yield* store.claimCall(message.id, at));
          assert.deepStrictEqual(
            yield* store.outgoing(message.id),
            Option.some(sent)
          );
          assert.deepStrictEqual(
            yield* store.journalMessage(otherText, Option.none()),
            { _tag: "journalled" }
          );
          assert.deepStrictEqual(
            (yield* store.outgoingOf(talk.id)).map(({ id }) => id),
            [message.id, otherText.id]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "keeps whether a member wrote a message in person, and journals none so by default",
    () =>
      Effect.gen(function* inPerson() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-04T11:00:00.000Z");
        const at = utc("2049-02-04T11:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "2049-02-04T09:00:00.000Z"
          );

          const other = yield* conversationOn(
            box,
            2,
            "2049-02-04T09:00:00.000Z"
          );

          yield* store.saveConversations([talk, other]);

          const byPerson = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.none(),
            "Back on Monday",
            at,
            true
          );

          const byKey = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            other,
            Option.none(),
            "Back on Monday",
            at
          );

          yield* store.journalMessage(byPerson, Option.none());
          yield* store.journalMessage(byKey, Option.none());

          assert.deepStrictEqual(
            (yield* store.outgoing(byPerson.id)).pipe(
              Option.map((kept) => kept.byPerson)
            ),
            Option.some(true)
          );
          assert.deepStrictEqual(
            (yield* store.outgoing(byKey.id)).pipe(
              Option.map((kept) => kept.byPerson)
            ),
            Option.some(false)
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "drops a message whose conversation went, and finds the stranded",
    () =>
      Effect.gen(function* drops() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-05T10:00:00.000Z");
        const at = utc("2049-02-05T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "2049-02-05T09:00:00.000Z"
          );

          const gone = yield* conversationOn(
            box,
            2,
            "2049-02-05T09:00:00.000Z"
          );

          yield* store.saveConversations([talk]);

          assert.deepStrictEqual(
            yield* store.journalMessage(
              writeMessage(
                yield* newId(OutgoingMessageIdSchema),
                gone,
                Option.none(),
                "Hello",
                at
              ),
              Option.none()
            ),
            { _tag: "dropped" }
          );

          const waiting = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.none(),
            "Hello",
            at
          );

          yield* store.journalMessage(waiting, Option.none());

          const stranded = yield* store.strandedMessages(
            DateTime.addDuration(at, "1 hour"),
            DateTime.addDuration(at, "1 hour"),
            1000
          );

          assert.isTrue(stranded.some(({ id }) => id === waiting.id));
          assert.strictEqual(yield* store.channelGone(box.channelId), 1);
          assert.deepStrictEqual(
            yield* store.outgoing(waiting.id),
            Option.none()
          );
          assert.deepStrictEqual(
            yield* store.box(box.channelId),
            Option.none()
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "hands over one stranded only while no call was claimed since it was listed",
    () =>
      Effect.gen(function* handOver() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-06T10:00:00.000Z");
        const at = utc("2049-02-06T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "2049-02-06T09:00:00.000Z"
          );

          yield* store.saveConversations([talk]);

          const message = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.none(),
            "Hello",
            at
          );

          yield* store.journalMessage(message, Option.none());
          yield* store.advanceMessage(
            Result.getOrThrow(beginMessage(message, at)),
            message
          );

          const later = DateTime.addDuration(at, "2 hours");
          const bound = DateTime.addDuration(at, "1 hour");

          // Listed as stranded, then its gate claims the call.
          assert.isTrue(
            (yield* store.strandedMessages(bound, bound, 1000)).some(
              ({ id }) => id === message.id
            )
          );
          assert.isTrue(yield* store.claimCall(message.id, later));
          assert.isTrue(
            Option.isNone(yield* store.handOver(message.id, later, bound))
          );
          assert.strictEqual(
            (yield* store.outgoing(message.id)).pipe(
              Option.map(({ status }) => status._tag),
              Option.getOrNull
            ),
            "sending"
          );

          // Its claim old enough: handed over.
          const handed = yield* store.handOver(
            message.id,
            DateTime.addDuration(later, "1 hour"),
            DateTime.addDuration(later, "10 minutes")
          );

          assert.deepStrictEqual(
            handed.pipe(
              Option.map(({ status }) =>
                status._tag === "unconfirmed" ? status.reason : status._tag
              ),
              Option.getOrNull
            ),
            "interrupted"
          );
          assert.deepStrictEqual(yield* store.outgoing(message.id), handed);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "deletes each message 30 days after it was sent, and a conversation once its last message is that old",
    () =>
      Effect.gen(function* purges() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "1935-03-01T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const old = yield* conversationOn(box, 1, "1935-01-01T10:00:00.000Z");

          const active = yield* conversationOn(
            box,
            2,
            "1935-02-15T10:00:00.000Z"
          );

          yield* store.saveConversations([old, active]);

          const stale = yield* messageOn(active, 1, "1935-01-01T10:00:00.000Z");
          const fresh = yield* messageOn(active, 2, "1935-02-15T10:00:00.000Z");

          yield* store.saveMessages([stale, fresh]);

          const purged = yield* store.purge(
            utc("1935-01-30T10:00:00.000Z"),
            1000
          );

          assert.isAtLeast(purged.conversations, 1);
          assert.isAtLeast(purged.messages, 1);
          assert.deepStrictEqual(
            yield* store.conversation(old.id),
            Option.none()
          );
          assert.deepStrictEqual(
            (yield* store.messagesOf(active.id)).map(({ id }) => id),
            [fresh.id]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "keeps a conversation past its time while a message to it is on its way",
    () =>
      Effect.gen(function* pending() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "1935-04-01T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "1935-03-01T10:00:00.000Z"
          );

          yield* store.saveConversations([talk]);
          yield* store.journalMessage(
            writeMessage(
              yield* newId(OutgoingMessageIdSchema),
              talk,
              Option.none(),
              "Hello",
              utc("1935-03-31T10:00:00.000Z")
            ),
            Option.none()
          );

          yield* store.purge(utc("1935-03-30T10:00:00.000Z"), 1000);

          assert.isTrue(Option.isSome(yield* store.conversation(talk.id)));
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "deletes a message left unconfirmed once it settled as long ago as Peal keeps, and then its conversation",
    () =>
      Effect.gen(function* unconfirmed() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "1935-05-01T10:00:00.000Z");
        const at = utc("1935-04-01T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "1935-04-01T09:00:00.000Z"
          );

          yield* store.saveConversations([talk]);

          const message = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.none(),
            "Hello",
            at
          );

          yield* store.journalMessage(message, Option.none());

          const begun = Result.getOrThrow(beginMessage(message, at));

          yield* store.advanceMessage(begun, message);
          yield* store.advanceMessage(
            Result.getOrThrow(
              settleMessage(
                begun,
                { _tag: "unconfirmed", reason: "interrupted" },
                at
              )
            ),
            begun
          );

          yield* store.purge(utc("1935-05-02T10:00:00.000Z"), 1000);

          assert.deepStrictEqual(
            yield* store.outgoing(message.id),
            Option.none()
          );
          assert.deepStrictEqual(
            yield* store.conversation(talk.id),
            Option.none()
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "deletes a conversation only once two whole listings in a row miss it",
    () =>
      Effect.gen(function* listings() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-10T10:00:00.000Z");
        const at = utc("2049-02-10T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const kept = yield* conversationOn(
            box,
            1,
            "2049-02-10T09:00:00.000Z"
          );

          const other = yield* conversationOn(
            box,
            2,
            "2049-02-10T09:00:00.000Z"
          );

          yield* store.saveConversations([kept, other]);

          assert.strictEqual(
            yield* store.dropUnlisted(box.channelId, [], at),
            0
          );
          assert.strictEqual(
            yield* store.dropUnlisted(box.channelId, ["c2"], at),
            0
          );
          // Listed again in between: the miss is forgotten.
          yield* store.dropUnlisted(box.channelId, ["c1", "c2"], at);
          assert.strictEqual(
            yield* store.dropUnlisted(box.channelId, ["c2"], at),
            0
          );
          assert.strictEqual(
            yield* store.dropUnlisted(box.channelId, ["c2"], at),
            1
          );
          assert.deepStrictEqual(
            yield* store.conversation(kept.id),
            Option.none()
          );
          assert.isTrue(Option.isSome(yield* store.conversation(other.id)));
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect("pages a conversation's messages, the latest first", () =>
    Effect.gen(function* pages() {
      const workspaceId = yield* freshWorkspace;
      const store = yield* MessageStore;
      const box = yield* boxOf(workspaceId, "2049-03-01T10:00:00.000Z");

      yield* Effect.gen(function* checks() {
        yield* store.follow([box]);

        const talk = yield* conversationOn(box, 1, "2049-03-01T09:00:00.000Z");

        yield* store.saveConversations([talk]);

        const first = yield* messageOn(talk, 1, "2049-03-01T08:00:00.000Z");
        const second = yield* messageOn(talk, 2, "2049-03-01T09:00:00.000Z");

        yield* store.saveMessages([first, second]);

        assert.deepStrictEqual(
          yield* store.pageOfMessages(talk.id, {
            before: Option.none(),
            limit: 1,
          }),
          [second]
        );
        assert.deepStrictEqual(
          yield* store.pageOfMessages(talk.id, {
            before: Option.some({
              messageId: second.id,
              sentAt: second.sentAt,
            }),
            limit: 10,
          }),
          [first]
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect(
    "turns a channel's messages on, lets applications in, and deletes what whole listings no longer show",
    () =>
      Effect.gen(function* settings() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-03-02T10:00:00.000Z");
        const at = utc("2049-03-02T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.switchOn(
            {
              channelId: box.channelId,
              enabledAt: at,
              enabledBy: Option.none(),
              workspaceId,
            },
            box
          );

          assert.deepStrictEqual(
            (yield* store.switchedOn(workspaceId)).map(
              ({ channelId }) => channelId
            ),
            [box.channelId]
          );
          assert.deepStrictEqual(
            yield* store.box(box.channelId),
            Option.some(box)
          );

          yield* store.allowApplication({
            clientId: "synthetic-client",
            grantedAt: at,
            grantedBy: Option.none(),
            workspaceId,
          });

          assert.isTrue(yield* store.allows(workspaceId, "synthetic-client"));

          yield* store.revokeApplication(workspaceId, "synthetic-client");

          assert.isFalse(yield* store.allows(workspaceId, "synthetic-client"));

          const listed = yield* conversationOn(
            box,
            1,
            "2049-03-02T09:00:00.000Z"
          );

          const gone = yield* conversationOn(
            box,
            2,
            "2049-03-02T09:00:00.000Z"
          );

          yield* store.saveConversations([listed, gone]);

          const listedAt = utc("2049-03-02T10:00:00.000Z");

          // Missed by two whole listings in a row.
          yield* store.dropUnlisted(box.channelId, ["c1"], listedAt);

          assert.strictEqual(
            yield* store.dropUnlisted(box.channelId, ["c1"], listedAt),
            1
          );
          assert.deepStrictEqual(
            yield* store.conversation(gone.id),
            Option.none()
          );

          yield* store.channelGone(box.channelId);

          assert.deepStrictEqual(yield* store.switchedOn(workspaceId), []);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "keeps a conversation missed, then shown by a listing that stopped short, through the next whole listing",
    () =>
      Effect.gen(function* sighted() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-03-03T10:00:00.000Z");
        const at = utc("2049-03-03T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "2049-03-03T09:00:00.000Z"
          );

          yield* store.saveConversations([talk]);

          yield* store.dropUnlisted(box.channelId, ["c9"], at);
          yield* store.clearUnlisted(box.channelId, ["c1"]);

          assert.strictEqual(
            yield* store.dropUnlisted(box.channelId, ["c9"], at),
            0
          );
          assert.isTrue(Option.isSome(yield* store.conversation(talk.id)));
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "erases a workspace's conversations, and forgets a user's name",
    () =>
      Effect.gen(function* erases() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const records = yield* EngagementRecords;
        const box = yield* boxOf(workspaceId, "2049-02-06T10:00:00.000Z");
        const at = utc("2049-02-06T10:00:00.000Z");

        const userId = UserIdSchema.make(
          "33333333-3333-4333-8333-333333333333"
        );

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const talk = yield* conversationOn(
            box,
            1,
            "2049-02-06T09:00:00.000Z"
          );

          yield* store.saveConversations([talk]);

          const sent = writeMessage(
            yield* newId(OutgoingMessageIdSchema),
            talk,
            Option.some(userId),
            "Hello",
            at
          );

          yield* store.journalMessage(sent, Option.none());

          assert.deepStrictEqual(
            (yield* records.exportUserMessages(userId)).map(({ id }) => id),
            [sent.id]
          );

          yield* records.forgetUser(userId);

          assert.deepStrictEqual(
            (yield* store.outgoing(sent.id)).pipe(
              Option.flatMap(({ authorId }) => authorId)
            ),
            Option.none()
          );
          assert.deepStrictEqual(yield* records.exportUserMessages(userId), []);

          yield* records.eraseWorkspace(workspaceId);

          assert.deepStrictEqual(
            yield* store.conversation(talk.id),
            Option.none()
          );
          assert.deepStrictEqual(
            yield* store.box(box.channelId),
            Option.none()
          );
          // Erased, its channels are followed no more.
          assert.strictEqual(yield* store.follow([box]), 0);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect("deletes a channel's conversations at once when it leaves", () =>
    Effect.gen(function* leaves() {
      const workspaceId = yield* freshWorkspace;
      const store = yield* MessageStore;
      const records = yield* EngagementRecords;
      const box = yield* boxOf(workspaceId, "2049-02-07T10:00:00.000Z");

      yield* Effect.gen(function* checks() {
        yield* store.follow([box]);

        const talk = yield* conversationOn(box, 1, "2049-02-07T09:00:00.000Z");

        yield* store.saveConversations([talk]);

        // Its subscription to the platform's events goes with the box: a
        // channel moved to another workspace, gone here, is followed
        // afresh there.
        yield* store.markFollowed(
          box.channelId,
          utc("2049-02-07T09:30:00.000Z")
        );
        yield* records.channelGone(
          box.channelId,
          "mastodon",
          utc("2049-02-07T10:00:00.000Z")
        );

        assert.deepStrictEqual(
          yield* store.conversation(talk.id),
          Option.none()
        );
        assert.deepStrictEqual(yield* store.box(box.channelId), Option.none());
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  // A message journalled on a conversation of the box: on its way; begun
  // (its attempt committed, its call waiting for the gate's turn) when
  // `attempted`; its call claimed too (it may have gone out) when
  // `claimed`.
  const pendingOn = Effect.fn("pendingOn")(function* pendingOn(
    box: MessageBox,
    n: number,
    at: string,
    attempted: boolean | "claimed"
  ) {
    const store = yield* MessageStore;
    const talk = yield* conversationOn(box, n, at);

    yield* store.saveConversations([talk]);

    const message = writeMessage(
      yield* newId(OutgoingMessageIdSchema),
      talk,
      Option.none(),
      "Thanks!",
      utc(at)
    );

    yield* store.journalMessage(message, Option.none());

    if (attempted !== false) {
      yield* store.advanceMessage(
        Result.getOrThrow(beginMessage(message, utc(at))),
        message
      );
    }

    if (attempted === "claimed") {
      yield* store.claimCall(message.id, utc(at));
    }

    return message;
  });

  it.effect(
    "gives back the outbound message of what never set out when a channel leaves",
    () =>
      Effect.gen(function* givesBack() {
        const workspaceId = yield* freshWorkspace;
        const records = yield* EngagementRecords;
        const box = yield* boxOf(workspaceId, "2049-02-08T10:00:00.000Z");
        const at = "2049-02-08T09:00:00.000Z";

        yield* Effect.gen(function* checks() {
          yield* MessageStore.use((store) => store.follow([box]));

          const waiting = yield* pendingOn(box, 1, at, false);

          // Its call claimed: it may be on the platform, and stays counted.
          yield* pendingOn(box, 2, at, "claimed");

          yield* records.channelGone(box.channelId, "mastodon", utc(at));

          assert.deepStrictEqual(
            (yield* givenBackIn(workspaceId)).map((claim) => [
              claim.meter,
              claim.units,
              DateTime.formatIso(claim.at),
            ]),
            [["outboundMessages", 1, DateTime.formatIso(waiting.createdAt)]]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "gives back the outbound message of what never set out when its workspace is erased",
    () =>
      Effect.gen(function* erased() {
        const workspaceId = yield* freshWorkspace;
        const records = yield* EngagementRecords;
        const box = yield* boxOf(workspaceId, "2049-02-09T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* MessageStore.use((store) => store.follow([box]));
          yield* pendingOn(box, 1, "2049-02-09T09:00:00.000Z", false);
          yield* records.eraseWorkspace(workspaceId);

          assert.lengthOf(yield* givenBackIn(workspaceId), 1);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "gives back the outbound message of one attempted whose call was never claimed when its channel leaves or moves, its messages are turned off or its workspace is erased",
    () =>
      Effect.gen(function* attemptedOnly() {
        const records = yield* EngagementRecords;
        const store = yield* MessageStore;

        // A move is the channel leaving its workspace: the same deletion.
        const deletions = [
          [
            "leaves",
            "2049-02-14T09:00:00.000Z",
            (box: MessageBox) =>
              records.channelGone(
                box.channelId,
                "facebook",
                utc("2049-02-14T09:00:00.000Z")
              ),
          ],
          [
            "turned off",
            "2049-02-15T09:00:00.000Z",
            (box: MessageBox) =>
              SqlClient.SqlClient.use((sql) =>
                sql.withTransaction(
                  Effect.gen(function* forgetting() {
                    yield* forgetChannelMessages(
                      store,
                      yield* PrivateReplyStore,
                      yield* MeteredUsage,
                      box.channelId
                    );
                  })
                )
              ),
          ],
          [
            "erased",
            "2049-02-16T09:00:00.000Z",
            (box: MessageBox) => records.eraseWorkspace(box.workspaceId),
          ],
        ] as const;

        for (const [how, at, deletion] of deletions) {
          const workspaceId = yield* freshWorkspace;
          const box = yield* boxOf(workspaceId, at);

          yield* Effect.gen(function* checks() {
            yield* store.follow([box]);

            // Its attempt committed, its call waiting for the gate's turn
            // (behind a publication): it never set out.
            const waiting = yield* pendingOn(box, 1, at, true);

            // Its call claimed: it may be out, and stays counted.
            yield* pendingOn(box, 2, at, "claimed");

            yield* deletion(box);

            assert.deepStrictEqual(
              (yield* givenBackIn(workspaceId)).map((claim) =>
                DateTime.formatIso(claim.at)
              ),
              [DateTime.formatIso(waiting.createdAt)],
              how
            );
          }).pipe(Effect.ensuring(forget(workspaceId)));
        }
      })
  );

  // A send that journals its message and claims its outbound message, then
  // holds its transaction open while `deletion` starts in another: the
  // send commits while the deletion runs.
  const sendDuring = Effect.fn("sendDuring")(function* sendDuring<E, R>(
    box: MessageBox,
    at: string,
    deletion: Effect.Effect<unknown, E, R>
  ) {
    const store = yield* MessageStore;
    const sql = yield* SqlClient.SqlClient;
    const talk = yield* conversationOn(box, 1, at);

    yield* store.saveConversations([talk]);

    const message = writeMessage(
      yield* newId(OutgoingMessageIdSchema),
      talk,
      Option.none(),
      "Thanks!",
      utc(at)
    );

    const journalled = yield* Deferred.make<true>();
    const release = yield* Deferred.make<true>();

    const sending = yield* sql
      .withTransaction(
        store
          .journalMessage(message, Option.none())
          .pipe(
            Effect.andThen(
              MeteredUsage.use((meters) =>
                meters.claim(
                  box.workspaceId,
                  "outboundMessages",
                  1,
                  message.createdAt
                )
              )
            ),
            Effect.andThen(Deferred.succeed(journalled, true)),
            Effect.andThen(Deferred.await(release))
          )
      )
      .pipe(Effect.forkChild);

    yield* Deferred.await(journalled);

    const deleting = yield* sql
      .withTransaction(deletion)
      .pipe(Effect.forkChild);

    // The deletion waits for the send, which then commits.
    for (
      let tries = 0;
      tries < 250 && !(yield* waitingOnEngagement);
      tries += 1
    ) {
      yield* pause;
    }

    yield* Deferred.succeed(release, true);
    yield* Fiber.join(sending);
    yield* Fiber.join(deleting);

    return { message, talk };
  });

  it.effect(
    "gives back the claim of a message sent while its channel leaves, its messages are turned off or its workspace is erased",
    () =>
      Effect.gen(function* racing() {
        const records = yield* EngagementRecords;
        const store = yield* MessageStore;

        const deletions = [
          [
            "leaves",
            "2049-02-10T09:00:00.000Z",
            (box: MessageBox) =>
              records.channelGone(
                box.channelId,
                "mastodon",
                utc("2049-02-10T09:00:00.000Z")
              ),
          ],
          [
            "turned off",
            "2049-02-11T09:00:00.000Z",
            (box: MessageBox) =>
              Effect.gen(function* forgetting() {
                const meters = yield* MeteredUsage;

                yield* forgetChannelMessages(
                  store,
                  yield* PrivateReplyStore,
                  meters,
                  box.channelId
                );
              }),
          ],
          [
            "erased",
            "2049-02-12T09:00:00.000Z",
            (box: MessageBox) => records.eraseWorkspace(box.workspaceId),
          ],
        ] as const;

        for (const [how, at, deletion] of deletions) {
          const workspaceId = yield* freshWorkspace;
          const box = yield* boxOf(workspaceId, at);

          yield* Effect.gen(function* checks() {
            yield* store.follow([box]);

            const { message } = yield* sendDuring(box, at, deletion(box));

            assert.deepStrictEqual(
              (yield* givenBackIn(workspaceId)).map((claim) =>
                DateTime.formatIso(claim.at)
              ),
              [DateTime.formatIso(message.createdAt)],
              how
            );
            assert.deepStrictEqual(
              yield* store.outgoing(message.id),
              Option.none(),
              how
            );
          }).pipe(Effect.ensuring(forget(workspaceId)));
        }
      })
  );

  it.effect(
    "keeps a conversation a whole listing misses again while a message to it is being sent",
    () =>
      Effect.gen(function* racing() {
        const store = yield* MessageStore;
        const workspaceId = yield* freshWorkspace;
        const at = "2049-02-13T09:00:00.000Z";
        const box = yield* boxOf(workspaceId, at);

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          // Another conversation, which the two listings delete.
          const talk = yield* conversationOn(box, 2, at);

          yield* store.saveConversations([talk]);

          const { talk: sentTo, message } = yield* sendDuring(
            box,
            at,
            store
              .dropUnlisted(box.channelId, ["c9"], utc(at))
              .pipe(
                Effect.andThen(
                  store.dropUnlisted(box.channelId, ["c9"], utc(at))
                )
              )
          );

          assert.deepStrictEqual(
            yield* store.conversation(talk.id),
            Option.none()
          );
          assert.isTrue(Option.isSome(yield* store.conversation(sentTo.id)));
          assert.isTrue(Option.isSome(yield* store.outgoing(message.id)));
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "keeps a conversation past its time that a message is being sent to while the retention runs",
    () =>
      Effect.gen(function* racing() {
        const store = yield* MessageStore;
        const workspaceId = yield* freshWorkspace;
        const at = "1935-05-01T09:00:00.000Z";
        const box = yield* boxOf(workspaceId, at);

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const { message, talk } = yield* sendDuring(
            box,
            at,
            store.purge(utc("1935-06-15T09:00:00.000Z"), 100)
          );

          assert.isTrue(Option.isSome(yield* store.conversation(talk.id)));
          assert.isTrue(Option.isSome(yield* store.outgoing(message.id)));
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "brings a box's read forward, never later, and keeps when the platform was asked for its events",
    () =>
      Effect.gen(function* forward() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-20T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          const read = recordBoxRead(
            box,
            Option.none(),
            utc("2049-02-20T10:01:00.000Z"),
            utc("2049-02-20T10:00:00.000Z")
          );

          yield* store.saveBox(read);

          // Due at 11:00: an event at 10:30 brings it to 10:30.
          assert.isTrue(
            yield* store.bringForward(
              box.channelId,
              utc("2049-02-20T10:30:00.000Z")
            )
          );

          const nextReadAt = (yield* store.box(box.channelId)).pipe(
            Option.map((kept) => DateTime.formatIso(kept.nextReadAt))
          );

          assert.deepStrictEqual(
            nextReadAt,
            Option.some("2049-02-20T10:30:00.000Z")
          );

          // A later event never puts it off.
          assert.isTrue(
            yield* store.bringForward(
              box.channelId,
              utc("2049-02-20T12:00:00.000Z")
            )
          );

          assert.deepStrictEqual(
            (yield* store.box(box.channelId)).pipe(
              Option.map((kept) => DateTime.formatIso(kept.nextReadAt))
            ),
            Option.some("2049-02-20T10:30:00.000Z")
          );

          // A channel without a box is no box.
          assert.isFalse(
            yield* store.bringForward(
              yield* newId(ChannelIdSchema),
              utc("2049-02-20T10:30:00.000Z")
            )
          );

          assert.deepStrictEqual(
            (yield* store.box(box.channelId)).pipe(
              Option.flatMap((kept) => kept.subscribedAt)
            ),
            Option.none()
          );

          yield* store.markFollowed(
            box.channelId,
            utc("2049-02-20T10:31:00.000Z")
          );

          // Saving the box's schedule leaves it as it is.
          yield* store.saveBox(read);

          assert.deepStrictEqual(
            (yield* store.box(box.channelId)).pipe(
              Option.flatMap((kept) => kept.subscribedAt),
              Option.map(DateTime.formatIso)
            ),
            Option.some("2049-02-20T10:31:00.000Z")
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "deletes the message a platform says was taken back, in that channel alone",
    () =>
      Effect.gen(function* takenBack() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-21T10:00:00.000Z");
        const other = yield* boxOf(workspaceId, "2049-02-21T10:00:00.000Z");

        yield* Effect.gen(function* checks() {
          yield* store.follow([box, other]);

          const here = yield* conversationOn(
            box,
            1,
            "2049-02-21T09:00:00.000Z"
          );

          const there = yield* conversationOn(
            other,
            1,
            "2049-02-21T09:00:00.000Z"
          );

          yield* store.saveConversations([here]);
          yield* store.saveConversations([there]);

          const gone = yield* messageOn(here, 1, "2049-02-21T09:00:00.000Z");
          const kept = yield* messageOn(here, 2, "2049-02-21T09:01:00.000Z");
          const twin = yield* messageOn(there, 1, "2049-02-21T09:00:00.000Z");

          yield* store.saveMessages([gone, kept]);
          yield* store.saveMessages([twin]);

          assert.strictEqual(
            yield* store.deleteTakenBack(box.channelId, "m1"),
            1
          );
          assert.strictEqual(
            yield* store.deleteTakenBack(box.channelId, "m-unknown"),
            0
          );

          assert.deepStrictEqual(
            (yield* store.messagesOf(here.id)).map(({ id }) => id),
            [kept.id]
          );
          assert.deepStrictEqual(
            (yield* store.messagesOf(there.id)).map(({ id }) => id),
            [twin.id]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "brings a box forward no earlier than the hold a refusal put on it, and a read lifts the hold",
    () =>
      Effect.gen(function* held() {
        const workspaceId = yield* freshWorkspace;
        const store = yield* MessageStore;
        const box = yield* boxOf(workspaceId, "2049-02-22T10:00:00.000Z");

        const nextOf = (channelId: typeof box.channelId) =>
          store
            .box(channelId)
            .pipe(
              Effect.map(
                Option.map((kept) => DateTime.formatIso(kept.nextReadAt))
              )
            );

        yield* Effect.gen(function* checks() {
          yield* store.follow([box]);

          // The platform asked to wait 15 minutes.
          const postponed = postponeBoxRead(
            box,
            utc("2049-02-22T10:00:00.000Z"),
            Duration.minutes(15)
          );

          yield* store.saveBox(postponed);

          yield* store.bringForward(
            box.channelId,
            utc("2049-02-22T10:01:00.000Z")
          );

          assert.deepStrictEqual(
            yield* nextOf(box.channelId),
            Option.some("2049-02-22T10:15:00.000Z")
          );
          assert.deepStrictEqual(
            (yield* store.box(box.channelId)).pipe(
              Option.flatMap((kept) => kept.notBefore),
              Option.map(DateTime.formatIso)
            ),
            Option.some("2049-02-22T10:15:00.000Z")
          );

          // Read since, the box waits for nothing: an event brings it to now.
          yield* store.saveBox(
            recordBoxRead(
              postponed,
              Option.none(),
              utc("2049-02-22T10:16:00.000Z"),
              utc("2049-02-22T10:15:00.000Z")
            )
          );

          yield* store.bringForward(
            box.channelId,
            utc("2049-02-22T10:17:00.000Z")
          );

          assert.deepStrictEqual(
            yield* nextOf(box.channelId),
            Option.some("2049-02-22T10:17:00.000Z")
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );
});
