import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { AgentApprovalNotPending } from "./agent-approval-not-pending.ts";
import { AgentBusy } from "./agent-busy.ts";
import { AgentChatNotFound } from "./agent-chat-not-found.ts";
import { AssistantInputRejected } from "./assistant-input-rejected.ts";
import { AssistantQuotaExceeded } from "./assistant-quota-exceeded.ts";
import { AssistantUnavailable } from "./assistant-unavailable.ts";
import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import { OwnTextLimitReached } from "./own-text-limit-reached.ts";
import { TextProviderBusy } from "./text-provider-busy.ts";
import { UsageAllowanceReached } from "./usage-allowance-reached.ts";
import { WorkspaceAccess } from "./workspace-access.ts";

// The agent is the web app's alone: a person in their own session talks
// to it, in the browser. It is not part of `Api`, so the OpenAPI document,
// the SDKs and the command line never see it: they reach Peal's tools
// through the MCP endpoint, with a model of their own.

/** The longest message a person sends the agent, in UTF-16 code units. */
export const maxAgentMessageLength = 8000;

/** The longest title a chat takes, in UTF-16 code units. */
export const maxAgentChatTitleLength = 120;

/** How many chats a page of the history holds at most. */
export const agentChatPageSize = 50;

/**
 * Who answers the workspace's agent: its own text provider, the server's
 * language model, or nobody.
 */
export const AgentSourceSchema = Schema.Literals(["workspace", "server"]);

export type AgentSource = typeof AgentSourceSchema.Type;

/**
 * Why the agent is off for this person:
 *
 * - `noModel`: the workspace brought no text provider and the server has
 *   no language model.
 * - `paymentMethod`: on a server that bills, the server's model needs a
 *   payment method on the billing account, and the workspace brought no
 *   provider of its own.
 */
export const AgentOffReasonSchema = Schema.Literals([
  "noModel",
  "paymentMethod",
]);

export type AgentOffReason = typeof AgentOffReasonSchema.Type;

/** Whether the agent answers this person in this workspace, and who. */
export const AgentStatusSchema = Schema.Struct({
  available: Schema.Boolean,
  reason: Schema.NullOr(AgentOffReasonSchema),
  source: Schema.NullOr(AgentSourceSchema),
}).annotate({ identifier: "AgentStatus" });

export type AgentStatus = typeof AgentStatusSchema.Type;

/** A chat with the agent: one person's, in one workspace. */
export const AgentChatSchema = Schema.Struct({
  createdAt: Schema.DateTimeUtc,
  id: Schema.String,
  starred: Schema.Boolean,
  // Null until the agent names it, after its first answer.
  title: Schema.NullOr(Schema.String),
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "AgentChat" });

export type AgentChat = typeof AgentChatSchema.Type;

/** A page of the person's chats in the workspace, the latest first. */
export const AgentChatPageSchema = Schema.Struct({
  chats: Schema.Array(AgentChatSchema),
  // The cursor of the next page, or null on the last one.
  nextCursor: Schema.NullOr(Schema.String),
}).annotate({ identifier: "AgentChatPage" });

export type AgentChatPage = typeof AgentChatPageSchema.Type;

/**
 * How a step of the agent's ended, or that it still runs: `refused` when
 * the person may not do it, or the tool answered why not.
 */
export const AgentStepStateSchema = Schema.Literals([
  "running",
  "done",
  "refused",
  "failed",
]);

export type AgentStepState = typeof AgentStepStateSchema.Type;

/**
 * A tool the agent called during an answer, by the tool's name (the MCP
 * tool's, such as `search_posts`); clients name it in the reader's
 * language, and fall back to a word of their own for a name they do not
 * know.
 */
export const AgentStepSchema = Schema.Struct({
  callId: Schema.String,
  state: AgentStepStateSchema,
  tool: Schema.String,
}).annotate({ identifier: "AgentStep" });

export type AgentStep = typeof AgentStepSchema.Type;

/** What the agent did to an item, as a card shows it. */
export const AgentCardActionSchema = Schema.Literals([
  "created",
  "updated",
  "scheduled",
  "published",
  "deleted",
  "replied",
]);

export type AgentCardAction = typeof AgentCardActionSchema.Type;

/**
 * An item the agent made or changed, shown as a card under its answer that
 * links to the item's page. The excerpt is the start of the item's text,
 * as the workspace holds it.
 */
export const AgentCardSchema = Schema.Union([
  Schema.TaggedStruct("post", {
    action: AgentCardActionSchema,
    channelIds: Schema.Array(Schema.String),
    excerpt: Schema.String,
    postId: Schema.String,
    // When the post goes out, once scheduled.
    scheduledAt: Schema.NullOr(Schema.DateTimeUtc),
  }),
  Schema.TaggedStruct("thread", {
    action: AgentCardActionSchema,
    excerpt: Schema.String,
    threadId: Schema.String,
  }),
]).annotate({ identifier: "AgentCard" });

export type AgentCard = typeof AgentCardSchema.Type;

/** Where a change the agent asked to make stands. */
export const AgentApprovalStateSchema = Schema.Literals([
  "pending",
  "approved",
  "declined",
  // A message sent before the answer replaced the request.
  "expired",
]);

export type AgentApprovalState = typeof AgentApprovalStateSchema.Type;

/**
 * A change the agent asks the person to approve before it is made: one
 * that others see, that cannot be undone, or that costs money. The fields
 * say what the change does, as far as the tool's request tells it, so the
 * person decides on what will happen, not on the agent's words.
 */
export const AgentApprovalSchema = Schema.Struct({
  // When the change happens: a post's time, or null for now.
  at: Schema.NullOr(Schema.DateTimeUtc),
  callId: Schema.String,
  channelIds: Schema.Array(Schema.String),
  postId: Schema.NullOr(Schema.String),
  state: AgentApprovalStateSchema,
  // The text the change sends, whole: a post's, or a reply's.
  text: Schema.NullOr(Schema.String),
  threadId: Schema.NullOr(Schema.String),
  tool: Schema.String,
}).annotate({ identifier: "AgentApproval" });

export type AgentApproval = typeof AgentApprovalSchema.Type;

/** How a person rated one of the agent's answers. */
export const AgentRatingSchema = Schema.Literals(["up", "down"]);

export type AgentRating = typeof AgentRatingSchema.Type;

/**
 * How a run of the agent ended: it answered, it waits for the person to
 * approve a change, the person stopped it, or it took as many steps as one
 * answer may.
 */
export const AgentOutcomeSchema = Schema.Literals([
  "answered",
  "awaitingApproval",
  "stopped",
  "stepLimit",
  "failed",
]);

export type AgentOutcome = typeof AgentOutcomeSchema.Type;

/**
 * One message of a chat: the person's, or the agent's answer with the
 * steps it took, the items it changed and the changes it asked to make.
 */
export const AgentMessageSchema = Schema.Struct({
  approvals: Schema.Array(AgentApprovalSchema),
  cards: Schema.Array(AgentCardSchema),
  createdAt: Schema.DateTimeUtc,
  // How long the agent worked on it; null for the person's.
  durationMs: Schema.NullOr(Schema.Int),
  id: Schema.String,
  outcome: Schema.NullOr(AgentOutcomeSchema),
  rating: Schema.NullOr(AgentRatingSchema),
  role: Schema.Literals(["user", "assistant"]),
  steps: Schema.Array(AgentStepSchema),
  // Markdown for the agent's (paragraphs, lists, emphasis, code, links),
  // plain text for the person's.
  text: Schema.String,
}).annotate({ identifier: "AgentMessage" });

export type AgentMessage = typeof AgentMessageSchema.Type;

/** A chat with its messages, oldest first. */
export const AgentChatDetailSchema = Schema.Struct({
  chat: AgentChatSchema,
  messages: Schema.Array(AgentMessageSchema),
}).annotate({ identifier: "AgentChatDetail" });

export type AgentChatDetail = typeof AgentChatDetailSchema.Type;

/**
 * Why a run failed once its events had started: the provider refused the
 * workspace's settings or could not be reached, took too long, or
 * answered something the agent cannot use; or the workspace ran out of
 * the agent's requests between two of the run's model rounds
 * (`allowanceReached`: the same allowance whose refusal before a run is
 * `AssistantQuotaExceeded`, `UsageAllowanceReached` or
 * `OwnTextLimitReached`).
 */
export const AgentFailureSchema = Schema.Literals([
  "providerRefused",
  "unreachable",
  "timedOut",
  "unusableAnswer",
  "allowanceReached",
  "failed",
]);

export type AgentFailure = typeof AgentFailureSchema.Type;

/**
 * What a run sends as it goes, as Server-Sent Events, one JSON event each:
 *
 * - `started`: the person's message (`userMessageId`, null when the run
 *   continues after an approval) and the answer's id. A run that
 *   continues after an approval goes on in the answer that asked for it:
 *   `messageId` is that answer's, whose text, steps, cards and duration
 *   the run's events add to.
 * - `text`: the next piece of the answer's text, to append.
 * - `step`: a tool call started, or how it ended (same `callId`).
 * - `card`: an item the agent made or changed.
 * - `approval`: a change that waits for the person's answer; the run ends
 *   after it with `awaitingApproval`. A run that continues after an
 *   answer first sends the answered change again, with its new state
 *   (`approved` or `declined`), under the same `callId`.
 * - `title`: the chat's new title.
 * - `finished`: the run ended, and how; the answer is saved.
 * - `failed`: the run stopped on a failure; what came before is saved.
 */
export const AgentEventSchema = Schema.Union([
  Schema.TaggedStruct("started", {
    messageId: Schema.String,
    userMessageId: Schema.NullOr(Schema.String),
  }),
  Schema.TaggedStruct("text", { delta: Schema.String }),
  Schema.TaggedStruct("step", { step: AgentStepSchema }),
  Schema.TaggedStruct("card", { card: AgentCardSchema }),
  Schema.TaggedStruct("approval", { approval: AgentApprovalSchema }),
  Schema.TaggedStruct("title", { title: Schema.String }),
  Schema.TaggedStruct("finished", {
    durationMs: Schema.Int,
    outcome: AgentOutcomeSchema,
  }),
  Schema.TaggedStruct("failed", { reason: AgentFailureSchema }),
]).annotate({ identifier: "AgentEvent" });

export type AgentEvent = typeof AgentEventSchema.Type;

/** A message to the agent. */
export const AgentMessageRequestSchema = Schema.Struct({
  text: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(maxAgentMessageLength)
  ),
  // The person's IANA time zone (`Europe/Paris`), so "tomorrow at 9" is
  // read on their clock; UTC when left out or unknown.
  timeZone: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(64))),
}).annotate({ identifier: "AgentMessageRequest" });

export type AgentMessageRequest = typeof AgentMessageRequestSchema.Type;

/** The person's answer to a change the agent asked to make. */
export const AgentApprovalAnswerSchema = Schema.Struct({
  approved: Schema.Boolean,
  timeZone: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(64))),
}).annotate({ identifier: "AgentApprovalAnswer" });

export type AgentApprovalAnswer = typeof AgentApprovalAnswerSchema.Type;

/** A chat's new title, or whether it is starred. */
export const AgentChatUpdateSchema = Schema.Struct({
  starred: Schema.optionalKey(Schema.Boolean),
  title: Schema.optionalKey(
    Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(maxAgentChatTitleLength)
    )
  ),
}).annotate({ identifier: "AgentChatUpdate" });

export type AgentChatUpdate = typeof AgentChatUpdateSchema.Type;

/** A rating of an answer, or null to take it back. */
export const AgentRatingRequestSchema = Schema.Struct({
  rating: Schema.NullOr(AgentRatingSchema),
}).annotate({ identifier: "AgentRatingRequest" });

const workspace = { workspaceId: Schema.String };

const chat = { ...workspace, chatId: Schema.String };

// A run's events, with a comment every 15 seconds while the model thinks,
// so no proxy closes a quiet response.
const runEvents = HttpApiSchema.StreamSse({
  data: AgentEventSchema,
  keepAlive: "15 seconds",
});

// What refuses a run before its events start.
const runErrors = [
  Forbidden,
  AgentChatNotFound,
  AgentBusy,
  AssistantUnavailable,
  AssistantQuotaExceeded,
  UsageAllowanceReached,
  OwnTextLimitReached,
  TextProviderBusy,
] as const;

/**
 * The agent: a chat in which a person asks about their workspace and has
 * it do things, with the tools of Peal's MCP endpoint, answered by the
 * workspace's own text provider or else the server's language model, as
 * the assistant is. It acts as the person, with their permissions, and
 * asks them first before any change that others see, that cannot be
 * undone or that costs money. Chats are the person's own: nobody else
 * reads them. Each endpoint needs assistant:use and a person in their own
 * session (Forbidden `personRequired` for an API key, an OAuth client or
 * staff acting as someone).
 */
export class AgentGroup extends HttpApiGroup.make("agent")
  .add(
    HttpApiEndpoint.get("status", "/", {
      error: Forbidden,
      params: workspace,
      success: AgentStatusSchema,
    }),
    HttpApiEndpoint.get("chats", "/chats", {
      error: Forbidden,
      params: workspace,
      query: { cursor: Schema.optionalKey(Schema.String) },
      success: AgentChatPageSchema,
    }),
    HttpApiEndpoint.post("createChat", "/chats", {
      error: Forbidden,
      params: workspace,
      success: AgentChatSchema.pipe(HttpApiSchema.status(201)),
    }),
    HttpApiEndpoint.get("chat", "/chats/:chatId", {
      error: [Forbidden, AgentChatNotFound],
      params: chat,
      success: AgentChatDetailSchema,
    }),
    HttpApiEndpoint.patch("updateChat", "/chats/:chatId", {
      error: [Forbidden, AgentChatNotFound],
      params: chat,
      payload: AgentChatUpdateSchema,
      success: AgentChatSchema,
    }),
    HttpApiEndpoint.delete("deleteChat", "/chats/:chatId", {
      error: [Forbidden, AgentChatNotFound],
      params: chat,
      success: HttpApiSchema.NoContent,
    }),
    HttpApiEndpoint.post("send", "/chats/:chatId/messages", {
      error: [...runErrors, AssistantInputRejected],
      params: chat,
      payload: AgentMessageRequestSchema,
      success: runEvents,
    }),
    HttpApiEndpoint.post("answer", "/chats/:chatId/approvals/:callId", {
      error: [...runErrors, AgentApprovalNotPending],
      params: { ...chat, callId: Schema.String },
      payload: AgentApprovalAnswerSchema,
      success: runEvents,
    }),
    HttpApiEndpoint.put("rate", "/chats/:chatId/messages/:messageId/rating", {
      error: [Forbidden, AgentChatNotFound],
      params: { ...chat, messageId: Schema.String },
      payload: AgentRatingRequestSchema,
      success: HttpApiSchema.NoContent,
    })
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/workspaces/:workspaceId/agent") {}
