import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";

import { AgentApprovalNotPending } from "./agent-approval-not-pending.ts";
import { AgentBusy } from "./agent-busy.ts";
import { AgentChatNotFound } from "./agent-chat-not-found.ts";
import { AgentMediaRejected } from "./agent-media-rejected.ts";
import { AgentSkillNotFound } from "./agent-skill-not-found.ts";
import { AgentSkillRefused } from "./agent-skill-refused.ts";
import {
  AgentMessageSkillSchema,
  AgentSkillListSchema,
  AgentSkillRequestSchema,
  AgentSkillSchema,
  AgentSkillUpdateSchema,
  maxAgentMessageSkills,
} from "./agent-skill.ts";
import { AssistantInputRejected } from "./assistant-input-rejected.ts";
import { AssistantQuotaExceeded } from "./assistant-quota-exceeded.ts";
import { AssistantUnavailable } from "./assistant-unavailable.ts";
import { Authentication } from "./authentication.ts";
import { Forbidden } from "./forbidden.ts";
import { InboxModerationActionSchema } from "./inbox.ts";
import { MediaKindSchema } from "./media.ts";
import { OwnTextLimitReached } from "./own-text-limit-reached.ts";
import { TextProviderBusy } from "./text-provider-busy.ts";
import { UsageAllowanceReached } from "./usage-allowance-reached.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

// The agent is the web app's alone: a person in their own session talks
// to it, in the browser. It is not part of `Api`, so the OpenAPI document,
// the SDKs and the command line never see it: they reach Peal's tools
// through the MCP endpoint, with a model of their own.

/** The most files a message to the agent attaches. */
export const maxAgentMessageMedia = 10;

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
  // Where the step falls in the answer: the length of the answer's text
  // when the agent called the tool, in UTF-16 code units. Clients show the
  // text before each step with it, and the text after the last step as the
  // answer itself.
  at: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
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
  // A message sent before the answer replaced the request, or it waited
  // past `agentApprovalLifetimeHours`.
  "expired",
  // Approved, but what it acts on read otherwise than the person was
  // shown (a post edited since): nothing was done, and the agent says so.
  "changed",
]);

export type AgentApprovalState = typeof AgentApprovalStateSchema.Type;

/**
 * How long a change waits for the person, in hours from the answer that
 * asked it: past it, it reads as expired and cannot be approved.
 */
export const agentApprovalLifetimeHours = 24;

/** A file of the workspace's media a post shows, with its alt text. */
export const AgentApprovalMediaSchema = Schema.Struct({
  altText: Schema.String,
  mediaId: Schema.String,
}).annotate({ identifier: "AgentApprovalMedia" });

export type AgentApprovalMedia = typeof AgentApprovalMediaSchema.Type;

/**
 * What a part of the post has instead on one of the change's channels:
 * its text, and the media it shows there instead of the part's (null:
 * the part's own).
 */
export const AgentApprovalOverrideSchema = Schema.Struct({
  channelId: Schema.String,
  media: Schema.NullOr(Schema.Array(AgentApprovalMediaSchema)),
  text: Schema.String,
}).annotate({ identifier: "AgentApprovalOverride" });

export type AgentApprovalOverride = typeof AgentApprovalOverrideSchema.Type;

/**
 * A part after the post's first, in order: a reply in a thread, or a
 * first comment, and how long it waits after the one before.
 */
export const AgentApprovalPartSchema = Schema.Struct({
  delaySeconds: Schema.Int,
  media: Schema.Array(AgentApprovalMediaSchema),
  overrides: Schema.Array(AgentApprovalOverrideSchema),
  text: Schema.String,
}).annotate({ identifier: "AgentApprovalPart" });

export type AgentApprovalPart = typeof AgentApprovalPartSchema.Type;

/**
 * The post a change acts on, as the workspace holds it when the change
 * is asked: all that goes out of it on the change's channels (a channel
 * set's expanded, and a signature already part of its text). Its text,
 * media and poll; what it has instead on some of those channels; the
 * parts after its first; each channel with what it sets on its platform
 * (`options`, the post's target options, by field; null for none); and
 * whether its links go out shortened.
 */
export const AgentApprovalPostSchema = Schema.Struct({
  followUps: Schema.Array(AgentApprovalPartSchema),
  media: Schema.Array(AgentApprovalMediaSchema),
  overrides: Schema.Array(AgentApprovalOverrideSchema),
  poll: Schema.NullOr(
    Schema.Struct({
      choices: Schema.Array(Schema.String),
      durationMinutes: Schema.Int,
      multipleChoice: Schema.Boolean,
    })
  ),
  shortenLinks: Schema.Boolean,
  targets: Schema.Array(
    Schema.Struct({
      channelId: Schema.String,
      options: Schema.NullOr(Schema.Record(Schema.String, Schema.Json)),
    })
  ),
  text: Schema.String,
}).annotate({ identifier: "AgentApprovalPost" });

export type AgentApprovalPost = typeof AgentApprovalPostSchema.Type;

/**
 * A change the agent asks the person to approve before it is made: one
 * that others see, that cannot be undone, or that costs money. The fields
 * say all of what the change does, from the tool's request and from what
 * it names as the workspace holds it, so the person decides on what will
 * happen, not on the agent's words: a change the server cannot show whole
 * is never asked. Once approved, it is made only if what it acts on still
 * reads as shown (`changed` otherwise).
 */
export const AgentApprovalSchema = Schema.Struct({
  // For marking a comment answered: true, or false to mark it unanswered;
  // null for any other change.
  answered: Schema.NullOr(Schema.Boolean),
  // When the change happens: a post's time, or null for now (or a queue's
  // next free slot, `queue`).
  at: Schema.NullOr(Schema.DateTimeUtc),
  callId: Schema.String,
  // The channels the change goes out on or acts on.
  channelIds: Schema.Array(Schema.String),
  // The comment sent with a request for changes, whole; null otherwise.
  comment: Schema.NullOr(Schema.String),
  // The comment or review the change answers or acts on, as the workspace
  // holds it: who wrote it (the name they show, else their handle) and the
  // start of its text, about 500 characters. Null for a change that names
  // none, or one the person may not read. Never the agent's words.
  inReplyTo: Schema.NullOr(
    Schema.Struct({ author: Schema.String, text: Schema.String })
  ),
  // What moderating a comment does to it; null for any other change.
  moderation: Schema.NullOr(InboxModerationActionSchema),
  // The part of a published post an edit replaces, from 0; null otherwise.
  part: Schema.NullOr(Schema.Int),
  // The post the change acts on, whole; null for a change that names none.
  post: Schema.NullOr(AgentApprovalPostSchema),
  postId: Schema.NullOr(Schema.String),
  // The queue a post goes to the next free slot of, by name; null for any
  // other change.
  queue: Schema.NullOr(Schema.String),
  // That queue's next free slot when the change was asked: an indication,
  // as the slot is taken when the change runs and may have moved by then.
  // Null for any other change, or a queue with no room.
  queueAt: Schema.NullOr(Schema.DateTimeUtc),
  state: AgentApprovalStateSchema,
  // The tags the change makes, or files the post under, by name and colour.
  tags: Schema.Array(
    Schema.Struct({ colour: Schema.String, name: Schema.String })
  ),
  // The text the change itself sends, whole: a reply, or a published
  // post's new text; null for a change that sends none (a post's is in
  // `post`).
  text: Schema.NullOr(Schema.String),
  threadId: Schema.NullOr(Schema.String),
  tool: Schema.String,
}).annotate({ identifier: "AgentApproval" });

export type AgentApproval = typeof AgentApprovalSchema.Type;

/**
 * A file of the workspace's media library attached to a person's message:
 * its id in the library, its kind, and the name it was uploaded with
 * (null for none).
 */
export const AgentMediaSchema = Schema.Struct({
  id: Schema.String,
  kind: MediaKindSchema,
  name: Schema.NullOr(Schema.String),
}).annotate({ identifier: "AgentMedia" });

export type AgentMedia = typeof AgentMediaSchema.Type;

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
  // The files the person attached to their message; none on the agent's.
  media: Schema.Array(AgentMediaSchema),
  outcome: Schema.NullOr(AgentOutcomeSchema),
  rating: Schema.NullOr(AgentRatingSchema),
  role: Schema.Literals(["user", "assistant"]),
  // The skills the person picked for their message; none on the agent's.
  skills: Schema.Array(AgentMessageSkillSchema),
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
 *   continues after an approval) and the answer's id. Every run writes a
 *   new answer, after the chat's earlier messages: a run that continues
 *   after an approval too, whose `messageId` is a new answer's, holding
 *   its text, the approved call's step and card, and what the model does
 *   next. The answer that asked keeps what it held.
 * - `text`: the next piece of the answer's text, to append.
 * - `step`: a tool call started, or how it ended (same `callId`).
 * - `card`: an item the agent made or changed.
 * - `approval`: a change that waits for the person's answer; the run ends
 *   after it with `awaitingApproval`. A run that continues after an
 *   answer first sends the answered change again, with its new state
 *   (`approved` or `declined`), under the same `callId`; a message sent
 *   while changes wait sends each of them again as `expired` first. Such
 *   a change stays on the answer that asked it, with its state there:
 *   clients update the card they show by its `callId`, whichever message
 *   holds it.
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

/**
 * A message to the agent, with the files of the workspace's media library
 * it attaches (`mediaIds`, `maxAgentMessageMedia` at most): each must be
 * one the person may read, and ready (AgentMediaRejected otherwise). The
 * agent reads which files they are, never their bytes, and may use their
 * ids where its tools take media, such as a draft's. It may pick skills
 * (`skillIds`, `maxAgentMessageSkills` at most), each one the person may
 * use (AgentSkillNotFound otherwise): the agent follows their
 * instructions for this message.
 */
export const AgentMessageRequestSchema = Schema.Struct({
  mediaIds: Schema.optionalKey(
    Schema.Array(Schema.String).check(Schema.isMaxLength(maxAgentMessageMedia))
  ),
  skillIds: Schema.optionalKey(
    Schema.Array(Schema.String).check(Schema.isMaxLength(maxAgentMessageSkills))
  ),
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

const chat = { chatId: Schema.String };

const skill = { skillId: Schema.String };

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
      headers: workspaceHeaders,

      success: AgentStatusSchema,
    }),
    HttpApiEndpoint.get("chats", "/chats", {
      error: Forbidden,
      headers: workspaceHeaders,

      query: { cursor: Schema.optionalKey(Schema.String) },
      success: AgentChatPageSchema,
    }),
    HttpApiEndpoint.post("createChat", "/chats", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: AgentChatSchema.pipe(HttpApiSchema.status(201)),
    }),
    HttpApiEndpoint.get("chat", "/chats/:chatId", {
      error: [Forbidden, AgentChatNotFound],
      headers: workspaceHeaders,
      params: chat,
      success: AgentChatDetailSchema,
    }),
    HttpApiEndpoint.patch("updateChat", "/chats/:chatId", {
      error: [Forbidden, AgentChatNotFound],
      headers: workspaceHeaders,
      params: chat,
      payload: AgentChatUpdateSchema,
      success: AgentChatSchema,
    }),
    HttpApiEndpoint.delete("deleteChat", "/chats/:chatId", {
      error: [Forbidden, AgentChatNotFound],
      headers: workspaceHeaders,
      params: chat,
      success: HttpApiSchema.NoContent,
    }),
    HttpApiEndpoint.post("send", "/chats/:chatId/messages", {
      error: [
        ...runErrors,
        AssistantInputRejected,
        AgentMediaRejected,
        AgentSkillNotFound,
      ],
      headers: workspaceHeaders,
      params: chat,
      payload: AgentMessageRequestSchema,
      success: runEvents,
    }),
    HttpApiEndpoint.post("answer", "/chats/:chatId/approvals/:callId", {
      error: [...runErrors, AgentApprovalNotPending],
      headers: workspaceHeaders,
      params: { ...chat, callId: Schema.String },
      payload: AgentApprovalAnswerSchema,
      success: runEvents,
    }),
    HttpApiEndpoint.put("rate", "/chats/:chatId/messages/:messageId/rating", {
      error: [Forbidden, AgentChatNotFound],
      headers: workspaceHeaders,
      params: { ...chat, messageId: Schema.String },
      payload: AgentRatingRequestSchema,
      success: HttpApiSchema.NoContent,
    }),
    HttpApiEndpoint.get("skills", "/skills", {
      error: Forbidden,
      headers: workspaceHeaders,

      success: AgentSkillListSchema,
    }),
    HttpApiEndpoint.post("createSkill", "/skills", {
      error: [Forbidden, AgentSkillRefused],
      headers: workspaceHeaders,

      payload: AgentSkillRequestSchema,
      success: AgentSkillSchema.pipe(HttpApiSchema.status(201)),
    }),
    HttpApiEndpoint.patch("updateSkill", "/skills/:skillId", {
      error: [Forbidden, AgentSkillNotFound, AgentSkillRefused],
      headers: workspaceHeaders,
      params: skill,
      payload: AgentSkillUpdateSchema,
      success: AgentSkillSchema,
    }),
    HttpApiEndpoint.delete("deleteSkill", "/skills/:skillId", {
      error: [Forbidden, AgentSkillNotFound, AgentSkillRefused],
      headers: workspaceHeaders,
      params: skill,
      success: HttpApiSchema.NoContent,
    })
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/agent") {}
