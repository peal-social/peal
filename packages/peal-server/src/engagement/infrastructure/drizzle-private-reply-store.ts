import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { Digest } from "effect/crypto";
import { SqlClient } from "effect/sql";

import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";
import type {
  PrivateReplyJournalled,
  PrivateReplyKey,
} from "#engagement/application/ports/private-reply-store.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";
import { PrivateReply } from "#engagement/domain/private-reply.ts";
import type { PrivateReplyStatus } from "#engagement/domain/private-reply.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { outgoingMessages, privateReplies } from "./schema.ts";

type Row = typeof privateReplies.$inferSelect;

// Rows are decoded with the domain's schema, so a row the domain could
// not have written fails loudly instead of being trusted.
const decodeReply = Schema.decodeUnknownEffect(PrivateReply);
const decodeId = Schema.decodeUnknownEffect(PrivateReplyIdSchema);

const failed = (cause: unknown) => new DatabaseError({ cause });

const utc = (value: Date | null) =>
  value === null ? null : DateTime.fromDateUnsafe(value);

const instant = (value: Date | null) => Option.fromNullOr(utc(value));

const date = (at: DateTime.Utc) => DateTime.toDateUtc(at);

const iso = (at: Option.Option<DateTime.Utc>) =>
  at.pipe(Option.map(DateTime.formatIso), Option.getOrNull);

const statusOf = (row: Row) => {
  if (row.status === "sending") {
    return { _tag: "sending", attemptedAt: instant(row.attemptedAt) };
  }

  if (row.status === "sent") {
    return {
      _tag: "sent",
      at: utc(row.settledAt),
      platformMessageId: Option.fromNullOr(row.platformMessageId),
    };
  }

  return { _tag: row.status, at: utc(row.settledAt), reason: row.reason };
};

const replyOf = (row: Row) =>
  decodeReply({
    authorId: Option.fromNullOr(row.authorId),
    channelId: row.channelId,
    commentId: row.commentId,
    createdAt: utc(row.createdAt),
    id: row.id,
    ruleId: Option.fromNullOr(row.ruleId),
    status: statusOf(row),
    text: row.text,
    threadId: row.threadId,
    workspaceId: row.workspaceId,
  }).pipe(Effect.orDie);

const statusColumns = (status: PrivateReplyStatus) => {
  switch (status._tag) {
    case "sending": {
      return {
        attemptedAt: iso(status.attemptedAt),
        platformMessageId: null,
        reason: null,
        settledAt: null,
      };
    }

    case "sent": {
      return {
        attemptedAt: null,
        platformMessageId: Option.getOrNull(status.platformMessageId),
        reason: null,
        settledAt: DateTime.formatIso(status.at),
      };
    }

    case "failed":
    case "unconfirmed": {
      return {
        attemptedAt: null,
        platformMessageId: null,
        reason: status.reason,
        settledAt: DateTime.formatIso(status.at),
      };
    }

    default: {
      return status satisfies never;
    }
  }
};

/**
 * The PrivateReplyStore on the engagement schema. A private reply is
 * journalled under its channel's message box (`FOR UPDATE`), which every
 * deletion of the channel's messages takes first: one that runs meanwhile
 * lists it and gives back its claim, or runs first, and the reply finds
 * the box gone. Deleting a comment or a thread deletes its private
 * replies (ON DELETE CASCADE).
 */
export const DrizzlePrivateReplyStore = Layer.effect(
  PrivateReplyStore,
  Effect.gen(function* DrizzlePrivateReplyStore() {
    const db = yield* Drizzle;
    const sql = yield* SqlClient.SqlClient;
    const digest = yield* Digest.Digest;

    const hashOf = (text: string) =>
      digest
        .digestHex(Digest.sha256, new TextEncoder().encode(text))
        .pipe(Effect.mapError(failed));

    // The private reply a key made in the workspace, compared with what
    // comes with the key now.
    const madeUnder = Effect.fn("PrivateReplyStore.madeUnder")(
      function* madeUnder(
        saved: PrivateReply,
        keyDigest: string,
        since: Option.Option<DateTime.Utc> = Option.none()
      ) {
        const [row] = yield* db
          .select()
          .from(privateReplies)
          .where(
            and(
              eq(privateReplies.workspaceId, saved.workspaceId),
              eq(privateReplies.keyDigest, keyDigest),
              ...Option.toArray(since).map((after) =>
                gt(privateReplies.createdAt, date(after))
              )
            )
          )
          .limit(1)
          .pipe(Effect.mapError(failed));

        if (row === undefined) {
          return Option.none<PrivateReplyJournalled>();
        }

        const earlier = yield* replyOf(row);

        const same =
          earlier.commentId === saved.commentId && earlier.text === saved.text;

        return Option.some<PrivateReplyJournalled>(
          same ? { _tag: "replayed", reply: earlier } : { _tag: "keyReused" }
        );
      }
    );

    const journal = Effect.fn("PrivateReplyStore.journal")(function* journal(
      saved: PrivateReply,
      key: Option.Option<PrivateReplyKey>
    ) {
      // The channel's box first, as every deletion of its messages takes
      // it before it lists what never set out.
      yield* sql`
        SELECT 1 FROM engagement.message_boxes
        WHERE channel_id = ${saved.channelId}::uuid
        FOR UPDATE
      `.pipe(Effect.mapError(failed));

      const keyDigest = Option.isSome(key)
        ? yield* hashOf(key.value.key)
        : null;

      if (Option.isSome(key) && keyDigest !== null) {
        // A use of the key older than its lifetime is forgotten.
        yield* sql`
          UPDATE engagement.private_replies SET key_digest = NULL
          WHERE workspace_id = ${saved.workspaceId}::uuid
            AND key_digest = ${keyDigest}
            AND created_at <= ${DateTime.formatIso(key.value.since)}::timestamptz
        `.pipe(Effect.mapError(failed));

        const made = yield* madeUnder(saved, keyDigest);

        if (Option.isSome(made)) {
          return made.value;
        }
      }

      const status = statusColumns(saved.status);

      // Only for a comment of the reply's workspace and channel, and only
      // while the channel's messages are on (its box is there).
      const inserted = yield* sql`
        INSERT INTO engagement.private_replies (
          id, workspace_id, channel_id, comment_id, thread_id, text,
          author_id, rule_id, status, reason, attempted_at, created_at,
          settled_at, key_digest
        )
        SELECT ${saved.id}::uuid, comment.workspace_id, comment.channel_id,
               comment.id, comment.thread_id, ${saved.text},
               ${Option.getOrNull(saved.authorId)}::uuid,
               ${Option.getOrNull(saved.ruleId)}::uuid,
               ${saved.status._tag}, ${status.reason}::text,
               ${status.attemptedAt}::timestamptz,
               ${DateTime.formatIso(saved.createdAt)}::timestamptz,
               ${status.settledAt}::timestamptz, ${keyDigest}::text
        FROM engagement.comments AS comment
        JOIN engagement.message_boxes AS box
          ON box.channel_id = comment.channel_id
         AND box.workspace_id = comment.workspace_id
        WHERE comment.id = ${saved.commentId}::uuid
          AND comment.workspace_id = ${saved.workspaceId}::uuid
          AND comment.channel_id = ${saved.channelId}::uuid
        ON CONFLICT DO NOTHING
        RETURNING id
      `.pipe(Effect.mapError(failed));

      if (inserted.length === 1) {
        return { _tag: "journalled" } satisfies PrivateReplyJournalled;
      }

      // Refused: by the key, used by a request that came just before, by
      // a private reply to the comment that did not fail, or the comment
      // or the channel's messages are gone.
      if (keyDigest !== null) {
        const made = yield* madeUnder(saved, keyDigest);

        if (Option.isSome(made)) {
          return made.value;
        }
      }

      const [pending] = yield* db
        .select({ id: privateReplies.id })
        .from(privateReplies)
        .where(
          and(
            eq(privateReplies.commentId, saved.commentId),
            eq(privateReplies.workspaceId, saved.workspaceId),
            inArray(privateReplies.status, ["sending", "unconfirmed", "sent"])
          )
        )
        .limit(1)
        .pipe(Effect.mapError(failed));

      const refused: PrivateReplyJournalled =
        pending === undefined
          ? { _tag: "dropped" }
          : {
              _tag: "pending",
              privateReplyId: yield* decodeId(pending.id).pipe(Effect.orDie),
            };

      return refused;
    });

    // What a key made since its lifetime began, read and never changed.
    const madeWithKey = Effect.fn("PrivateReplyStore.madeWithKey")(
      function* madeWithKey(saved: PrivateReply, key: PrivateReplyKey) {
        return yield* madeUnder(
          saved,
          yield* hashOf(key.key),
          Option.some(key.since)
        );
      }
    );

    const privateReply = Effect.fn("PrivateReplyStore.privateReply")(
      function* privateReply(privateReplyId: string) {
        const [row] = yield* db
          .select()
          .from(privateReplies)
          .where(eq(privateReplies.id, privateReplyId))
          .limit(1)
          .pipe(Effect.mapError(failed));

        return row === undefined
          ? Option.none<PrivateReply>()
          : Option.some(yield* replyOf(row));
      }
    );

    const ofComments = Effect.fn("PrivateReplyStore.ofComments")(
      function* ofComments(commentIds: readonly string[]) {
        if (commentIds.length === 0) {
          return [];
        }

        const rows = yield* db
          .select()
          .from(privateReplies)
          .where(inArray(privateReplies.commentId, [...commentIds]))
          .orderBy(asc(privateReplies.id))
          .pipe(Effect.mapError(failed));

        return yield* Effect.all(rows.map(replyOf));
      }
    );

    // Only from the status it was read in, attempt included.
    const advance = Effect.fn("PrivateReplyStore.advance")(function* advance(
      next: PrivateReply,
      from: PrivateReply
    ) {
      const status = statusColumns(next.status);
      const before = statusColumns(from.status);

      const moved = yield* sql`
        UPDATE engagement.private_replies
        SET status = ${next.status._tag},
            attempted_at = ${status.attemptedAt}::timestamptz,
            settled_at = ${status.settledAt}::timestamptz,
            reason = ${status.reason}::text,
            platform_message_id = ${status.platformMessageId}::text
        WHERE id = ${next.id}::uuid
          AND status = ${from.status._tag}
          AND attempted_at IS NOT DISTINCT FROM ${before.attemptedAt}::timestamptz
        RETURNING id
      `.pipe(Effect.mapError(failed));

      return moved.length === 1;
    });

    const claimCall = Effect.fn("PrivateReplyStore.claimCall")(
      function* claimCall(privateReplyId: string, at: DateTime.Utc) {
        const claimed = yield* sql`
          UPDATE engagement.private_replies
          SET call_claimed_at = ${DateTime.formatIso(at)}::timestamptz
          WHERE id = ${privateReplyId}::uuid AND status = 'sending'
          RETURNING id
        `.pipe(Effect.mapError(failed));

        return claimed.length === 1;
      }
    );

    const stranded = Effect.fn("PrivateReplyStore.stranded")(function* stranded(
      writtenBefore: DateTime.Utc,
      calledBefore: DateTime.Utc,
      limit: number
    ) {
      const rows = yield* db
        .select()
        .from(privateReplies)
        .where(
          and(
            eq(privateReplies.status, "sending"),
            lte(privateReplies.createdAt, date(writtenBefore)),
            or(
              isNull(privateReplies.callClaimedAt),
              lte(privateReplies.callClaimedAt, date(calledBefore))
            )
          )
        )
        .orderBy(asc(privateReplies.createdAt), asc(privateReplies.id))
        .limit(limit)
        .pipe(Effect.mapError(failed));

      return yield* Effect.all(rows.map(replyOf));
    });

    const dropUnsent = Effect.fn("PrivateReplyStore.dropUnsent")(
      function* dropUnsent(channelId: string) {
        // After the box, which a private reply being journalled holds: it
        // is then listed here, not deleted unseen.
        yield* sql`
          SELECT 1 FROM engagement.message_boxes
          WHERE channel_id = ${channelId}::uuid
          FOR UPDATE
        `.pipe(Effect.mapError(failed));

        const rows = yield* db
          .delete(privateReplies)
          .where(
            and(
              eq(privateReplies.channelId, channelId),
              eq(privateReplies.status, "sending"),
              // Its call never claimed: an attempt recorded that waited
              // for the gate's turn never left either.
              isNull(privateReplies.callClaimedAt)
            )
          )
          .returning()
          .pipe(Effect.mapError(failed));

        return yield* Effect.all(rows.map(replyOf));
      }
    );

    const dropUnsentOfRule = Effect.fn("PrivateReplyStore.dropUnsentOfRule")(
      function* dropUnsentOfRule(ruleId: string) {
        // Under the boxes of their channels, after the rule's row the
        // caller holds, in one order: none journalled meanwhile is
        // deleted unseen.
        yield* sql`
          SELECT 1 FROM engagement.message_boxes
          WHERE channel_id IN (
            SELECT channel_id FROM engagement.private_replies
            WHERE rule_id = ${ruleId}::uuid AND status = 'sending'
          )
          ORDER BY channel_id
          FOR UPDATE
        `.pipe(Effect.mapError(failed));

        const rows = yield* db
          .delete(privateReplies)
          .where(
            and(
              eq(privateReplies.ruleId, ruleId),
              eq(privateReplies.status, "sending"),
              isNull(privateReplies.callClaimedAt)
            )
          )
          .returning()
          .pipe(Effect.mapError(failed));

        return yield* Effect.all(rows.map(replyOf));
      }
    );

    const handOver = Effect.fn("PrivateReplyStore.handOver")(function* handOver(
      privateReplyId: string,
      at: DateTime.Utc,
      calledBefore: DateTime.Utc
    ) {
      const [row] = yield* db
        .update(privateReplies)
        .set({
          attemptedAt: null,
          reason: "interrupted",
          settledAt: date(at),
          status: "unconfirmed",
        })
        .where(
          and(
            eq(privateReplies.id, privateReplyId),
            eq(privateReplies.status, "sending"),
            or(
              isNull(privateReplies.callClaimedAt),
              lte(privateReplies.callClaimedAt, date(calledBefore))
            )
          )
        )
        .returning()
        .pipe(Effect.mapError(failed));

      return row === undefined
        ? Option.none<PrivateReply>()
        : Option.some(yield* replyOf(row));
    });

    const sentIdsOf = Effect.fn("PrivateReplyStore.sentIdsOf")(
      function* sentIdsOf(channelId: string, except: string) {
        const replied = yield* sql<{ readonly id: string }>`
          SELECT platform_message_id AS id FROM engagement.private_replies
          WHERE channel_id = ${channelId}::uuid
            AND id <> ${except}::uuid
            AND platform_message_id IS NOT NULL
        `.pipe(Effect.mapError(failed));

        const messaged = yield* db
          .select({ id: outgoingMessages.platformMessageId })
          .from(outgoingMessages)
          .where(eq(outgoingMessages.channelId, channelId))
          .pipe(Effect.mapError(failed));

        return [
          ...new Set([
            ...replied.map(({ id }) => id),
            ...messaged.flatMap(({ id }) => (id === null ? [] : [id])),
          ]),
        ];
      }
    );

    const dropIfForgotten = Effect.fn("PrivateReplyStore.dropIfForgotten")(
      function* dropIfForgotten(privateReplyId: string) {
        const dropped = yield* sql`
          DELETE FROM engagement.private_replies AS reply
          USING engagement.comments AS comment
          WHERE reply.id = ${privateReplyId}::uuid
            AND reply.status <> 'sending'
            AND comment.id = reply.comment_id
            AND comment.state = 'deleted'
          RETURNING reply.id
        `.pipe(Effect.mapError(failed));

        return dropped.length === 1;
      }
    );

    const purge = Effect.fn("PrivateReplyStore.purge")(function* purge(
      keptSince: DateTime.Utc,
      limit: number
    ) {
      const deleted = yield* sql`
        DELETE FROM engagement.private_replies
        WHERE id IN (
          SELECT id FROM engagement.private_replies
          WHERE status IN ('sent', 'failed', 'unconfirmed')
            AND settled_at < ${DateTime.formatIso(keptSince)}::timestamptz
          ORDER BY settled_at
          LIMIT ${limit}
        )
        RETURNING id
      `.pipe(Effect.mapError(failed));

      return deleted.length;
    });

    return PrivateReplyStore.of({
      advance,
      claimCall,
      dropIfForgotten,
      dropUnsent,
      dropUnsentOfRule,
      handOver,
      journal,
      madeWithKey,
      ofComments,
      privateReply,
      purge,
      sentIdsOf,
      stranded,
    });
  })
).pipe(Layer.provide(Digest.layerWebCrypto));
