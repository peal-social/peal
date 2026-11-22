import { Context } from "effect";
import type { DateTime, Effect, Option, Schema } from "effect";

import type { AgentChat } from "#agent/domain/agent-chat.ts";
import type { AgentMessage } from "#agent/domain/agent-message.ts";
import type { AgentRating } from "#agent/domain/agent-parts.ts";
import type { ChatPosition } from "#agent/domain/chat-cursor.ts";
import type { AgentChatId, AgentMessageId } from "#agent/domain/ids.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, Uuid7, WorkspaceId } from "#shared/domain/ids.ts";

/** Whose chats: one person's, in one workspace. */
export interface ChatOwner {
  readonly userId: UserId;
  readonly workspaceId: WorkspaceId;
}

/** A page of a person's chats, the latest first. */
export interface ChatPage {
  readonly chats: readonly AgentChat[];
  readonly next: Option.Option<ChatPosition>;
}

/** A chat as a run takes it up: what the model reads, and its last answer. */
export interface ChatRun {
  readonly chat: AgentChat;
  /** What the model reads of the chat so far, as its JSON (effect/ai's `Prompt`). */
  readonly history: Schema.Json;
  /**
   * The answer whose changes still wait for the person, the latest one
   * that holds any: the round that asked them; none when nothing waits.
   */
  readonly asking: Option.Option<AgentMessage>;
}

/** A chat as its author's export holds it. */
export interface ExportedChat {
  readonly chat: AgentChat;
  readonly messages: readonly AgentMessage[];
}

/** A change to a chat's title or star. */
export interface ChatChange {
  readonly starred?: boolean;
  readonly title?: string;
}

/**
 * The chats and their messages, in the agent's schema. Every read and
 * change but the erasures, the export and the retention names the chat's
 * owner: another person's chat reads as none. A database failure is a
 * defect, but where another context waits on it (erasures, the export).
 */
export class AgentChats extends Context.Service<
  AgentChats,
  {
    readonly create: (chat: AgentChat) => Effect.Effect<void>;
    /** The owner's chats with a message, the latest written in first. */
    readonly page: (
      owner: ChatOwner,
      after: Option.Option<ChatPosition>,
      limit: number
    ) => Effect.Effect<ChatPage>;
    readonly chat: (
      owner: ChatOwner,
      chatId: AgentChatId
    ) => Effect.Effect<Option.Option<AgentChat>>;
    /** The chat with its messages, oldest first. */
    readonly detail: (
      owner: ChatOwner,
      chatId: AgentChatId
    ) => Effect.Effect<Option.Option<ExportedChat>>;
    readonly update: (
      owner: ChatOwner,
      chatId: AgentChatId,
      change: ChatChange
    ) => Effect.Effect<Option.Option<AgentChat>>;
    /** Deletes the chat and its messages; false when there was none. */
    readonly remove: (
      owner: ChatOwner,
      chatId: AgentChatId
    ) => Effect.Effect<boolean>;
    /** Rates an answer of the chat, or takes the rating back; false when there is no such answer. */
    readonly rate: (
      owner: ChatOwner,
      chatId: AgentChatId,
      messageId: AgentMessageId,
      rating: Option.Option<AgentRating>
    ) => Effect.Effect<boolean>;
    /**
     * Claims the chat for a run, `runId`, until `until`: none when the chat
     * is not the owner's, or another run holds it and its claim has not
     * lapsed (a server that crashed during a run lets go of it so).
     */
    readonly claim: (
      owner: ChatOwner,
      chatId: AgentChatId,
      runId: Uuid7,
      now: DateTime.Utc,
      until: DateTime.Utc
    ) => Effect.Effect<Option.Option<ChatRun>>;
    /** Lets go of the run's claim, when it still holds it. */
    readonly release: (
      chatId: AgentChatId,
      runId: Uuid7
    ) => Effect.Effect<void>;
    /** Keeps a message, its answer or the person's, as it now stands, and what the model reads. */
    readonly save: (
      chatId: AgentChatId,
      message: AgentMessage,
      history: Schema.Json,
      at: DateTime.Utc
    ) => Effect.Effect<void>;
    /** Names the chat. */
    readonly name: (chatId: AgentChatId, title: string) => Effect.Effect<void>;
    /**
     * Deletes the chats whose last message was written before `before`,
     * and those never written in made before `emptyBefore`; how many.
     */
    readonly purge: (
      before: DateTime.Utc,
      emptyBefore: DateTime.Utc
    ) => Effect.Effect<number, DatabaseError>;
    readonly eraseWorkspace: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, DatabaseError>;
    readonly eraseUser: (userId: UserId) => Effect.Effect<void, DatabaseError>;
    readonly eraseMember: (
      owner: ChatOwner
    ) => Effect.Effect<void, DatabaseError>;
    /** Every chat of the user, in every workspace, with its messages. */
    readonly exportUser: (
      userId: UserId
    ) => Effect.Effect<readonly ExportedChat[], DatabaseError>;
  }
>()("peal-server/agent/application/AgentChats") {}
