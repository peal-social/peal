import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Ref, Result } from "effect";
import { SqlClient } from "effect/sql";

import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import { forgetChannelMessages } from "#engagement/application/forget-channel-messages.ts";
import { CommentRuleNotices } from "#engagement/application/ports/comment-rule-notices.ts";
import { EngagementStore } from "#engagement/application/ports/engagement-store.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";
import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { receiveComment } from "#engagement/domain/comment.ts";
import type { Comment } from "#engagement/domain/comment.ts";
import { followBox } from "#engagement/domain/message-box.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";
import {
  beginPrivateReply,
  settlePrivateReply,
  writePrivateReply,
} from "#engagement/domain/private-reply.ts";
import type {
  PrivateReply,
  PrivateReplyOutcome,
} from "#engagement/domain/private-reply.ts";
import { ThreadIdSchema } from "#engagement/domain/thread-id.ts";
import { followPost } from "#engagement/domain/thread.ts";
import { DrizzleEngagementRecords } from "#engagement/infrastructure/drizzle-engagement-records.ts";
import { DrizzleEngagementStore } from "#engagement/infrastructure/drizzle-engagement-store.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { DrizzlePrivateReplyStore } from "#engagement/infrastructure/drizzle-private-reply-store.ts";
import { newId } from "#shared/application/ids.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
  UserIdSchema,
} from "#shared/domain/ids.ts";
import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { DatabaseTest, freshWorkspace } from "#test/channels/support.ts";
import { memberId, reading } from "#test/engagement/support.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";

// The Postgres store of private replies, on the database DATABASE_URL
// names. Each test writes rows of its own workspace, at instants no other
// suite uses (2051; the purge in 1937), and deletes them after.

// The records give back the outbound message of what never set out, on
// meters that count in memory.
const StoreTest = Layer.mergeAll(
  DrizzlePrivateReplyStore,
  DrizzleEngagementStore,
  DrizzleMessageStore,
  DrizzleEngagementRecords.pipe(Layer.provide(CommentRuleNotices.none))
).pipe(
  Layer.provideMerge(fakeMeters({ allowed: Option.none() })),
  Layer.provideMerge(DatabaseTest)
);

// What the meters were given back for the workspace.
const givenBackIn = (workspaceId: WorkspaceId) =>
  FakeMetersLedger.use(Ref.get).pipe(
    Effect.map(({ givenBack }) =>
      givenBack.filter((claim) => claim.workspaceId === workspaceId)
    )
  );

const utc = (iso: string) => DateTime.makeUnsafe(iso);

const at = utc("2051-03-02T10:00:00.000Z");

const forget = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use((sql) =>
    Effect.all([
      sql`DELETE FROM engagement.threads WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`,
    ])
  ).pipe(Effect.orDie);

// A comment under a post of the workspace on a channel, kept, and the
// channel's messages turned on unless `messagesOn` is false.
const commentIn = Effect.fn("commentIn")(function* commentIn(
  workspaceId: WorkspaceId,
  options: {
    readonly channelId?: ChannelId;
    readonly messagesOn?: boolean;
  } = {}
) {
  const store = yield* EngagementStore;
  const messages = yield* MessageStore;
  const channelId = options.channelId ?? (yield* newId(ChannelIdSchema));

  const thread = followPost(yield* newId(ThreadIdSchema), {
    authorId: Option.none(),
    channelId,
    permalink: Option.some("https://social.example/@studio/1"),
    platformPostId: PlatformPostIdSchema.make("1001"),
    postId: yield* newId(PostIdSchema),
    publishedAt: at,
    targetId: yield* newId(PostTargetIdSchema),
    workspaceId,
  });

  yield* store.follow([thread]);

  const comment = receiveComment(
    yield* newId(CommentIdSchema),
    thread,
    reading(1, { writtenAt: at }),
    at
  );

  yield* store.saveComments([comment]);

  if (options.messagesOn ?? true) {
    yield* messages.switchOn(
      { channelId, enabledAt: at, enabledBy: Option.none(), workspaceId },
      followBox({ channelId, workspaceId }, at)
    );
  }

  return comment;
});

const writtenFor = Effect.fn("writtenFor")(function* writtenFor(
  comment: Comment,
  text?: string
) {
  return writePrivateReply(
    yield* newId(PrivateReplyIdSchema),
    comment,
    Option.some(memberId),
    text ?? "Here is the link you asked for.",
    Option.none(),
    at
  );
});

const journalled = (
  reply: PrivateReply,
  key: Option.Option<string> = Option.none()
) =>
  Effect.gen(function* journalling() {
    const store = yield* PrivateReplyStore;
    const sql = yield* SqlClient.SqlClient;

    return yield* sql.withTransaction(
      store.journal(
        reply,
        key.pipe(
          Option.map((given) => ({
            key: given,
            since: DateTime.subtractDuration(at, "1 day"),
          }))
        )
      )
    );
  });

const settled = (
  reply: PrivateReply,
  outcome: PrivateReplyOutcome,
  settledAt: DateTime.Utc = at
) =>
  Effect.gen(function* settling() {
    const store = yield* PrivateReplyStore;

    const next = Result.getOrThrow(
      settlePrivateReply(reply, outcome, settledAt)
    );

    assert.isTrue(yield* store.advance(next, reply));

    return next;
  });

layer(StoreTest)("the private reply store", (it) => {
  it.effect("journals one private reply a comment, of two sent together", () =>
    Effect.gen(function* together() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const comment = yield* commentIn(workspaceId);
        const first = yield* writtenFor(comment);
        const second = yield* writtenFor(comment, "Another text.");

        const outcomes = yield* Effect.all(
          [journalled(first), journalled(second)],
          { concurrency: "unbounded" }
        );

        assert.deepStrictEqual(outcomes.map(({ _tag }) => _tag).toSorted(), [
          "journalled",
          "pending",
        ]);

        const store = yield* PrivateReplyStore;

        assert.strictEqual((yield* store.ofComments([comment.id])).length, 1);
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect(
    "holds the comment once sent or unconfirmed, and lets another through once failed",
    () =>
      Effect.gen(function* holds() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const comment = yield* commentIn(workspaceId);
          const first = yield* writtenFor(comment);

          assert.strictEqual((yield* journalled(first))._tag, "journalled");

          const sent = yield* settled(first, {
            _tag: "sent",
            platformMessageId: "m-1",
          });

          const refused = yield* journalled(yield* writtenFor(comment));

          assert.deepStrictEqual(refused, {
            _tag: "pending",
            privateReplyId: sent.id,
          });

          // Another comment's: one unconfirmed holds it too.
          const other = yield* commentIn(workspaceId);
          const doubted = yield* writtenFor(other);

          yield* journalled(doubted);
          yield* settled(doubted, {
            _tag: "unconfirmed",
            reason: "noResponse",
          });

          assert.strictEqual(
            (yield* journalled(yield* writtenFor(other)))._tag,
            "pending"
          );

          // A third's failed: another goes through.
          const third = yield* commentIn(workspaceId);
          const failing = yield* writtenFor(third);

          yield* journalled(failing);
          yield* settled(failing, { _tag: "failed", reason: "refused" });

          assert.strictEqual(
            (yield* journalled(yield* writtenFor(third)))._tag,
            "journalled"
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "answers a key sent again with what it made, and refuses it for another text",
    () =>
      Effect.gen(function* keyed() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const comment = yield* commentIn(workspaceId);
          const first = yield* writtenFor(comment);
          const key = Option.some("synthetic-key-1");

          assert.strictEqual(
            (yield* journalled(first, key))._tag,
            "journalled"
          );

          const again = yield* journalled(yield* writtenFor(comment), key);

          assert.strictEqual(again._tag, "replayed");
          assert.strictEqual(
            again._tag === "replayed" ? again.reply.id : undefined,
            first.id
          );

          const reused = yield* journalled(
            yield* writtenFor(comment, "Another text."),
            key
          );

          assert.strictEqual(reused._tag, "keyReused");

          const store = yield* PrivateReplyStore;

          assert.strictEqual(
            (yield* store.madeWithKey(first, {
              key: "synthetic-key-1",
              since: DateTime.subtractDuration(at, "1 hour"),
            })).pipe(
              Option.map(({ _tag }) => _tag),
              Option.getOrNull
            ),
            "replayed"
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect(
    "journals nothing while the channel's messages are off, nor for another workspace's comment",
    () =>
      Effect.gen(function* refused() {
        const workspaceId = yield* freshWorkspace;
        const otherWorkspace = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const off = yield* commentIn(workspaceId, { messagesOn: false });

          assert.strictEqual(
            (yield* journalled(yield* writtenFor(off)))._tag,
            "dropped"
          );

          // One Page in two workspaces: the same channel id never, but the
          // same comment id named under the other workspace is not found.
          const theirs = yield* commentIn(otherWorkspace);
          const forged = yield* writtenFor(theirs);

          assert.strictEqual(
            (yield* journalled(
              writePrivateReply(
                forged.id,
                {
                  channelId: theirs.channelId,
                  id: theirs.id,
                  threadId: theirs.threadId,
                  workspaceId,
                },
                Option.none(),
                forged.text,
                Option.none(),
                at
              )
            ))._tag,
            "dropped"
          );

          const store = yield* PrivateReplyStore;

          assert.deepStrictEqual(yield* store.ofComments([theirs.id]), []);
        }).pipe(
          Effect.ensuring(forget(workspaceId)),
          Effect.ensuring(forget(otherWorkspace))
        );
      })
  );

  it.effect(
    "claims a call only while on its way, and lists those stranded",
    () =>
      Effect.gen(function* claims() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const store = yield* PrivateReplyStore;
          const comment = yield* commentIn(workspaceId);
          const reply = yield* writtenFor(comment);

          yield* journalled(reply);

          const begun = Result.getOrThrow(beginPrivateReply(reply, at));

          assert.isTrue(yield* store.advance(begun, reply));
          // From a state it is no longer in: nothing moves.
          assert.isFalse(yield* store.advance(begun, reply));

          const stranded = yield* store.stranded(
            DateTime.addDuration(at, "1 hour"),
            DateTime.addDuration(at, "1 hour"),
            100
          );

          assert.isTrue(stranded.some(({ id }) => id === reply.id));
          assert.isTrue(
            yield* store.claimCall(begun.id, DateTime.addDuration(at, "1 hour"))
          );

          // Claimed since: not stranded before that claim is old.
          assert.isFalse(
            (yield* store.stranded(
              DateTime.addDuration(at, "2 hours"),
              DateTime.addDuration(at, "50 minutes"),
              100
            )).some(({ id }) => id === reply.id)
          );

          yield* settled(begun, { _tag: "sent", platformMessageId: "m-2" });

          assert.isFalse(yield* store.claimCall(begun.id, at));
          assert.deepStrictEqual(
            yield* store.sentIdsOf(
              comment.channelId,
              PrivateReplyIdSchema.make("00000000-0000-7000-8000-000000000000")
            ),
            ["m-2"]
          );
          assert.deepStrictEqual(
            yield* store.sentIdsOf(comment.channelId, begun.id),
            []
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect("drops what never set out, and keeps what may have gone", () =>
    Effect.gen(function* drops() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const store = yield* PrivateReplyStore;
        const sql = yield* SqlClient.SqlClient;
        const channelId = yield* newId(ChannelIdSchema);

        const unsent = yield* writtenFor(
          yield* commentIn(workspaceId, { channelId })
        );

        const begun = yield* writtenFor(
          yield* commentIn(workspaceId, { channelId })
        );

        yield* journalled(unsent);
        yield* journalled(begun);

        assert.isTrue(
          yield* store.advance(
            Result.getOrThrow(beginPrivateReply(begun, at)),
            begun
          )
        );

        const dropped = yield* sql.withTransaction(store.dropUnsent(channelId));

        assert.deepStrictEqual(
          dropped.map(({ id }) => id),
          [unsent.id]
        );
        assert.isTrue(Option.isNone(yield* store.privateReply(unsent.id)));
        assert.isTrue(Option.isSome(yield* store.privateReply(begun.id)));
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect("goes 30 days after it settled, and with its comment", () =>
    Effect.gen(function* purges() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const store = yield* PrivateReplyStore;
        const comments = yield* EngagementStore;
        const old = yield* commentIn(workspaceId);
        const settledReply = yield* writtenFor(old);

        yield* journalled(settledReply);
        // Settled at an instant no other suite's rows are before.
        const purgedAt = utc("1937-03-02T10:00:00.000Z");

        yield* settled(
          settledReply,
          { _tag: "failed", reason: "refused" },
          purgedAt
        );

        const sending = yield* writtenFor(yield* commentIn(workspaceId));

        yield* journalled(sending);

        assert.strictEqual(
          yield* store.purge(DateTime.addDuration(purgedAt, "1 second"), 100),
          1
        );
        assert.isTrue(
          Option.isNone(yield* store.privateReply(settledReply.id))
        );
        assert.isTrue(Option.isSome(yield* store.privateReply(sending.id)));

        // The thread deleted takes its comments, and their private replies.
        const thread = yield* comments.thread(
          ThreadIdSchema.make(
            (yield* store.privateReply(sending.id)).pipe(
              Option.map(({ threadId }) => threadId),
              Option.getOrThrow
            )
          )
        );

        assert.isTrue(Option.isSome(thread));

        yield* forget(workspaceId);

        assert.isTrue(Option.isNone(yield* store.privateReply(sending.id)));
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );
  it.effect("goes with its channel, giving back what never set out", () =>
    Effect.gen(function* channelGone() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const store = yield* PrivateReplyStore;
        const records = yield* EngagementRecords;
        const channelId = yield* newId(ChannelIdSchema);

        const unsent = yield* writtenFor(
          yield* commentIn(workspaceId, { channelId })
        );

        const sent = yield* writtenFor(
          yield* commentIn(workspaceId, { channelId })
        );

        yield* journalled(unsent);
        yield* journalled(sent);
        yield* settled(sent, { _tag: "sent", platformMessageId: "m-3" });

        yield* records.channelGone(channelId, "facebook", at);

        assert.isTrue(Option.isNone(yield* store.privateReply(unsent.id)));
        assert.isTrue(Option.isNone(yield* store.privateReply(sent.id)));
        assert.deepStrictEqual(
          (yield* givenBackIn(workspaceId)).map(({ at: claimedAt }) =>
            DateTime.formatIso(claimedAt)
          ),
          [DateTime.formatIso(unsent.createdAt)]
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect("goes with its workspace, giving back what never set out", () =>
    Effect.gen(function* erased() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const store = yield* PrivateReplyStore;
        const records = yield* EngagementRecords;
        const unsent = yield* writtenFor(yield* commentIn(workspaceId));

        yield* journalled(unsent);
        yield* records.eraseWorkspace(workspaceId);

        assert.isTrue(Option.isNone(yield* store.privateReply(unsent.id)));
        assert.strictEqual((yield* givenBackIn(workspaceId)).length, 1);
      }).pipe(
        Effect.ensuring(forget(workspaceId)),
        Effect.ensuring(
          SqlClient.SqlClient.use(
            (sql) =>
              sql`DELETE FROM engagement.erased_workspaces WHERE workspace_id = ${workspaceId}`
          ).pipe(Effect.orDie)
        )
      );
    })
  );

  it.effect(
    "forgets its author once their account is closed, and lists it in their export",
    () =>
      Effect.gen(function* forgotten() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const store = yield* PrivateReplyStore;
          const records = yield* EngagementRecords;
          const author = UserIdSchema.make(yield* newId(ChannelIdSchema));
          const comment = yield* commentIn(workspaceId);

          const reply = writePrivateReply(
            yield* newId(PrivateReplyIdSchema),
            comment,
            Option.some(author),
            "Here is the link you asked for.",
            Option.none(),
            at
          );

          yield* journalled(reply);

          const exported = yield* records.exportUserPrivateReplies(author);

          assert.deepStrictEqual(exported, [
            {
              channelId: comment.channelId,
              commentId: comment.id,
              createdAt: at,
              id: reply.id,
              status: "sending",
              text: "Here is the link you asked for.",
              workspaceId,
            },
          ]);

          yield* records.forgetUser(author);

          assert.deepStrictEqual(
            (yield* store.privateReply(reply.id)).pipe(
              Option.map(({ authorId }) => authorId),
              Option.getOrThrow
            ),
            Option.none()
          );
          assert.deepStrictEqual(
            yield* records.exportUserPrivateReplies(author),
            []
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );

  it.effect("holds a channel that moves while one is on its call", () =>
    Effect.gen(function* inFlight() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const store = yield* PrivateReplyStore;
        const records = yield* EngagementRecords;
        const sql = yield* SqlClient.SqlClient;
        const comment = yield* commentIn(workspaceId);
        const reply = yield* writtenFor(comment);

        yield* journalled(reply);

        // On its way, no call claimed: the channel may move.
        yield* sql.withTransaction(
          records.ensureChannelIdle(workspaceId, comment.channelId)
        );

        const begun = Result.getOrThrow(beginPrivateReply(reply, at));

        yield* store.advance(begun, reply);
        yield* store.claimCall(begun.id, at);

        const refused = yield* sql
          .withTransaction(
            records.ensureChannelIdle(workspaceId, comment.channelId)
          )
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "SendsInFlight");
      }).pipe(Effect.ensuring(forget(workspaceId)));
    })
  );

  it.effect(
    "turned off with the channel's messages, gives back and drops what never set out",
    () =>
      Effect.gen(function* switchedOff() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const store = yield* PrivateReplyStore;
          const messages = yield* MessageStore;
          const meters = yield* MeteredUsage;
          const sql = yield* SqlClient.SqlClient;
          const channelId = yield* newId(ChannelIdSchema);

          const unsent = yield* writtenFor(
            yield* commentIn(workspaceId, { channelId })
          );

          const sent = yield* writtenFor(
            yield* commentIn(workspaceId, { channelId })
          );

          yield* journalled(unsent);
          yield* journalled(sent);
          yield* settled(sent, { _tag: "sent", platformMessageId: "m-4" });

          yield* sql.withTransaction(
            forgetChannelMessages(messages, store, meters, channelId)
          );

          assert.isTrue(Option.isNone(yield* store.privateReply(unsent.id)));
          // Sent stays until its purge.
          assert.isTrue(Option.isSome(yield* store.privateReply(sent.id)));
          assert.strictEqual((yield* givenBackIn(workspaceId)).length, 1);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
  );
});
