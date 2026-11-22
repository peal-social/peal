import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { DateTime, Effect, Layer, Option, Schema } from "effect";

import { AgentChats } from "#agent/application/ports/agent-chats.ts";
import type {
  ChatOwner,
  ExportedChat,
} from "#agent/application/ports/agent-chats.ts";
import { AgentChat } from "#agent/domain/agent-chat.ts";
import { AgentMessage } from "#agent/domain/agent-message.ts";
import { maxTitleLength } from "#agent/domain/run-limits.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { storableLine } from "#shared/domain/platform-text.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import { chats, messages } from "./schema.ts";

type ChatRow = typeof chats.$inferSelect;

type MessageRow = typeof messages.$inferSelect;

/** The columns a chat's rename or star changes. */
type ChatChangeColumns = Partial<
  Pick<typeof chats.$inferInsert, "starred" | "title">
>;

const failed = (cause: unknown) => new DatabaseError({ cause });

const date = (instant: DateTime.Utc) => DateTime.toDateUtc(instant);

const utc = (value: Date) => DateTime.fromDateUnsafe(value);

const decodeChat = Schema.decodeUnknownEffect(AgentChat);

const decodeMessage = Schema.decodeUnknownEffect(AgentMessage);

const encodeMessage = Schema.encodeEffect(AgentMessage);

const decodeJson = Schema.decodeUnknownEffect(Schema.Json);

// Rows are decoded with the domain's schemas, so one the domain could not
// have written fails loudly instead of being trusted.
const chatOf = (row: ChatRow) =>
  decodeChat({
    createdAt: utc(row.createdAt),
    id: row.id,
    starred: row.starred,
    title: Option.fromNullOr(row.title),
    updatedAt: utc(row.updatedAt),
    userId: row.userId,
    workspaceId: row.workspaceId,
  }).pipe(Effect.orDie);

const messageOf = (row: MessageRow) =>
  decodeMessage({
    approvals: row.approvals,
    cards: row.cards,
    createdAt: utc(row.createdAt),
    durationMs: Option.fromNullOr(row.durationMs),
    id: row.id,
    outcome: Option.fromNullOr(row.outcome),
    rating: Option.fromNullOr(row.rating),
    role: row.role,
    steps: row.steps,
    text: row.text,
  }).pipe(Effect.orDie);

// The message's columns, its JSON as the domain encodes it.
const columnsOf = (chatId: string, message: AgentMessage) =>
  encodeMessage(message).pipe(
    Effect.orDie,
    Effect.map((encoded) => ({
      approvals: encoded.approvals,
      cards: encoded.cards,
      chatId,
      createdAt: date(message.createdAt),
      durationMs: Option.getOrNull(message.durationMs),
      id: message.id,
      outcome: Option.getOrNull(message.outcome),
      rating: Option.getOrNull(message.rating),
      role: message.role,
      steps: encoded.steps,
      text: message.text,
    }))
  );

const owned = ({ userId, workspaceId }: ChatOwner) =>
  and(eq(chats.workspaceId, workspaceId), eq(chats.userId, userId));

/**
 * AgentChats in the agent's schema: one row a chat, one a message, the
 * messages deleted with their chat. A run's claim is one conditional
 * update, so two servers never both hold a chat.
 */
export const DrizzleAgentChatsLive = Layer.effect(
  AgentChats,
  Effect.gen(function* DrizzleAgentChats() {
    const db = yield* Drizzle;

    // The messages of these chats, oldest first, each with its chat.
    const messagesOf = (chatIds: readonly string[]) =>
      chatIds.length === 0
        ? Effect.succeed([])
        : db
            .select()
            .from(messages)
            .where(inArray(messages.chatId, [...chatIds]))
            .orderBy(asc(messages.id))
            .pipe(
              Effect.mapError(failed),
              Effect.flatMap(
                Effect.forEach((row) =>
                  messageOf(row).pipe(
                    Effect.map((message) => ({ chatId: row.chatId, message }))
                  )
                )
              )
            );

    const withMessages = (rows: readonly ChatRow[]) =>
      Effect.gen(function* exported() {
        const all = yield* messagesOf(rows.map(({ id }) => id));

        return yield* Effect.all(
          rows.map((row) =>
            chatOf(row).pipe(
              Effect.map((chat): ExportedChat => ({
                chat,
                messages: all
                  .filter(({ chatId }) => chatId === row.id)
                  .map(({ message }) => message),
              }))
            )
          )
        );
      });

    const lastAnswerOf = (chatId: string) =>
      db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chatId), eq(messages.role, "assistant")))
        .orderBy(desc(messages.id))
        .limit(1)
        .pipe(
          Effect.orDie,
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.succeedNone
              : messageOf(rows[0]).pipe(Effect.map(Option.some))
          )
        );

    return AgentChats.of({
      claim: (owner, chatId, runId, now, until) =>
        db
          .update(chats)
          .set({ runId, runUntil: date(until) })
          .where(
            and(
              owned(owner),
              eq(chats.id, chatId),
              or(isNull(chats.runId), lt(chats.runUntil, date(now)))
            )
          )
          .returning()
          .pipe(
            Effect.orDie,
            Effect.flatMap((rows) =>
              rows[0] === undefined
                ? Effect.succeedNone
                : Effect.all({
                    chat: chatOf(rows[0]),
                    history: decodeJson(rows[0].history).pipe(Effect.orDie),
                    lastAnswer: lastAnswerOf(rows[0].id),
                  }).pipe(Effect.map(Option.some))
            ),
            Effect.withSpan("AgentChats.claim")
          ),
      create: (chat) =>
        db
          .insert(chats)
          .values({
            createdAt: date(chat.createdAt),
            history: { content: [] },
            id: chat.id,
            runId: null,
            runUntil: null,
            starred: chat.starred,
            title: Option.getOrNull(chat.title),
            updatedAt: date(chat.updatedAt),
            userId: chat.userId,
            workspaceId: chat.workspaceId,
          })
          .pipe(
            Effect.orDie,
            Effect.asVoid,
            Effect.withSpan("AgentChats.create")
          ),
      detail: (owner, chatId) =>
        db
          .select()
          .from(chats)
          .where(and(owned(owner), eq(chats.id, chatId)))
          .pipe(
            Effect.orDie,
            Effect.flatMap((rows) =>
              rows[0] === undefined
                ? Effect.succeedNone
                : Effect.all({
                    chat: chatOf(rows[0]),
                    messages: messagesOf([rows[0].id]).pipe(
                      Effect.orDie,
                      Effect.map((all) => all.map(({ message }) => message))
                    ),
                  }).pipe(Effect.map(Option.some))
            ),
            Effect.withSpan("AgentChats.detail")
          ),
      eraseMember: (owner) =>
        db
          .delete(chats)
          .where(owned(owner))
          .pipe(
            Effect.mapError(failed),
            Effect.asVoid,
            Effect.withSpan("AgentChats.eraseMember")
          ),
      eraseUser: (userId) =>
        db
          .delete(chats)
          .where(eq(chats.userId, userId))
          .pipe(
            Effect.mapError(failed),
            Effect.asVoid,
            Effect.withSpan("AgentChats.eraseUser")
          ),
      eraseWorkspace: (workspaceId) =>
        db
          .delete(chats)
          .where(eq(chats.workspaceId, workspaceId))
          .pipe(
            Effect.mapError(failed),
            Effect.asVoid,
            Effect.withSpan("AgentChats.eraseWorkspace")
          ),
      exportUser: (userId) =>
        db
          .select()
          .from(chats)
          .where(eq(chats.userId, userId))
          .orderBy(asc(chats.createdAt), asc(chats.id))
          .pipe(
            Effect.mapError(failed),
            Effect.flatMap(withMessages),
            Effect.map((exported): readonly ExportedChat[] => exported),
            Effect.withSpan("AgentChats.exportUser")
          ),
      chat: (owner, chatId) =>
        db
          .select()
          .from(chats)
          .where(and(owned(owner), eq(chats.id, chatId)))
          .pipe(
            Effect.orDie,
            Effect.flatMap((rows) =>
              rows[0] === undefined
                ? Effect.succeedNone
                : chatOf(rows[0]).pipe(Effect.map(Option.some))
            ),
            Effect.withSpan("AgentChats.chat")
          ),
      name: (chatId, title) =>
        db
          .update(chats)
          .set({ title: storableLine(title, maxTitleLength) })
          .where(eq(chats.id, chatId))
          .pipe(
            Effect.orDie,
            Effect.asVoid,
            Effect.withSpan("AgentChats.name")
          ),
      page: (owner, after, limit) =>
        db
          .select()
          .from(chats)
          .where(
            Option.match(after, {
              onNone: () => owned(owner),
              onSome: ({ id, updatedAt }) =>
                and(
                  owned(owner),
                  or(
                    lt(chats.updatedAt, date(updatedAt)),
                    and(eq(chats.updatedAt, date(updatedAt)), lt(chats.id, id))
                  )
                ),
            })
          )
          .orderBy(desc(chats.updatedAt), desc(chats.id))
          .limit(limit + 1)
          .pipe(
            Effect.orDie,
            Effect.flatMap((rows) =>
              Effect.all(rows.slice(0, limit).map(chatOf)).pipe(
                Effect.map((page) => {
                  const last = page.at(-1);

                  return {
                    chats: page,
                    next:
                      rows.length > limit && last !== undefined
                        ? Option.some({
                            id: last.id,
                            updatedAt: last.updatedAt,
                          })
                        : Option.none(),
                  };
                })
              )
            ),
            Effect.withSpan("AgentChats.page")
          ),
      purge: (before) =>
        db
          .delete(chats)
          .where(lt(chats.updatedAt, date(before)))
          .returning({ id: chats.id })
          .pipe(
            Effect.mapError(failed),
            Effect.map((rows) => rows.length),
            Effect.withSpan("AgentChats.purge")
          ),
      rate: (owner, chatId, messageId, rating) =>
        Effect.gen(function* rate() {
          const chat = yield* db
            .select({ id: chats.id })
            .from(chats)
            .where(and(owned(owner), eq(chats.id, chatId)))
            .pipe(Effect.orDie);

          if (chat.length === 0) {
            return false;
          }

          const rated = yield* db
            .update(messages)
            .set({ rating: Option.getOrNull(rating) })
            .where(
              and(
                eq(messages.chatId, chatId),
                eq(messages.id, messageId),
                eq(messages.role, "assistant")
              )
            )
            .returning({ id: messages.id })
            .pipe(Effect.orDie);

          return rated.length > 0;
        }).pipe(Effect.withSpan("AgentChats.rate")),
      release: (chatId, runId) =>
        db
          .update(chats)
          .set({ runId: null, runUntil: null })
          .where(and(eq(chats.id, chatId), eq(chats.runId, runId)))
          .pipe(
            Effect.orDie,
            Effect.asVoid,
            Effect.withSpan("AgentChats.release")
          ),
      remove: (owner, chatId) =>
        db
          .delete(chats)
          .where(and(owned(owner), eq(chats.id, chatId)))
          .returning({ id: chats.id })
          .pipe(
            Effect.orDie,
            Effect.map((rows) => rows.length > 0),
            Effect.withSpan("AgentChats.remove")
          ),
      save: (chatId, message, history, at) =>
        Effect.gen(function* save() {
          const columns = yield* columnsOf(chatId, message);

          yield* db
            .insert(messages)
            .values(columns)
            .onConflictDoUpdate({
              set: {
                approvals: columns.approvals,
                cards: columns.cards,
                durationMs: columns.durationMs,
                outcome: columns.outcome,
                steps: columns.steps,
                text: columns.text,
              },
              target: messages.id,
            })
            .pipe(Effect.orDie);

          yield* db
            .update(chats)
            .set({ history, updatedAt: date(at) })
            .where(eq(chats.id, chatId))
            .pipe(Effect.orDie);
        }).pipe(Effect.withSpan("AgentChats.save")),
      update: (owner, chatId, change) =>
        Effect.gen(function* updating() {
          const set: ChatChangeColumns = {};

          if (change.starred !== undefined) {
            set.starred = change.starred;
          }

          if (change.title !== undefined) {
            set.title = storableLine(change.title, maxTitleLength);
          }

          const rows =
            Object.keys(set).length === 0
              ? yield* db
                  .select()
                  .from(chats)
                  .where(and(owned(owner), eq(chats.id, chatId)))
                  .pipe(Effect.orDie)
              : yield* db
                  .update(chats)
                  .set(set)
                  .where(and(owned(owner), eq(chats.id, chatId)))
                  .returning()
                  .pipe(Effect.orDie);

          return rows[0] === undefined
            ? Option.none()
            : Option.some(yield* chatOf(rows[0]));
        }).pipe(Effect.withSpan("AgentChats.update")),
    });
  })
);
