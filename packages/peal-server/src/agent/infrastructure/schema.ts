import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// The agent's tables, in their own Postgres schema. Ids of other contexts
// (workspaces, users) have no foreign key: the workspace context's
// erasures reach the rows through AgentRecords. Instants are timestamptz
// written from the Clock (never NOW()), so tests control them.
export const agentSchema = pgSchema("agent");

const instant = (name: string) => timestamp(name, { withTimezone: true });

/**
 * One person's chats with the agent, in one workspace. `history` is what
 * the model reads of the chat (effect/ai's `Prompt`, as JSON), its tools'
 * answers cut to a bound; `run_id` and `run_until` hold the chat for one
 * run at a time, across servers, until the claim lapses. `updated_at` is
 * when its last message was written, from which its 90 days count.
 */
export const chats = agentSchema.table(
  "chats",
  {
    createdAt: instant("created_at").notNull(),
    history: jsonb("history").notNull(),
    id: uuid("id").primaryKey(),
    runId: uuid("run_id"),
    runUntil: instant("run_until"),
    starred: boolean("starred").notNull(),
    title: text("title"),
    updatedAt: instant("updated_at").notNull(),
    userId: uuid("user_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
  },
  (table) => [
    index("chats_owner_updated").on(
      table.workspaceId,
      table.userId,
      table.updatedAt.desc(),
      table.id.desc()
    ),
    index("chats_user").on(table.userId),
    index("chats_updated").on(table.updatedAt),
  ]
);

/**
 * The messages of a chat, ordered by their ids (UUIDv7): the person's
 * (`user`) and the agent's answers (`assistant`), with the steps, cards and
 * approvals an answer holds, as JSON.
 */
export const messages = agentSchema.table(
  "messages",
  {
    approvals: jsonb("approvals").notNull(),
    cards: jsonb("cards").notNull(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    createdAt: instant("created_at").notNull(),
    durationMs: integer("duration_ms"),
    id: uuid("id").primaryKey(),
    // The files of the workspace's media library the person attached.
    media: jsonb("media").notNull().default([]),
    outcome: text("outcome"),
    rating: text("rating"),
    role: text("role").notNull(),
    steps: jsonb("steps").notNull(),
    text: text("text").notNull(),
  },
  (table) => [index("messages_chat").on(table.chatId, table.id)]
);
