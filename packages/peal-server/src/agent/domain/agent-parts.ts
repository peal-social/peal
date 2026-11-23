import { Effect, Schema } from "effect";

// What an answer holds besides its text, as the contract tells it
// (`peal-contract/agent`), which the api layer answers as they are:
// test/agent/api/contract.test.ts keeps both equal.

/** How a step ended, or that it still runs. */
export const AgentStepStateSchema = Schema.Literals([
  "running",
  "done",
  "refused",
  "failed",
]);

export type AgentStepState = typeof AgentStepStateSchema.Type;

/**
 * A tool the agent called, by its name, and where it falls in the answer:
 * the length of the answer's text when it was called, in UTF-16 code
 * units. Steps saved before it was kept read as at the answer's start.
 */
export const AgentStepSchema = Schema.Struct({
  at: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(0))
  ),
  callId: Schema.String,
  state: AgentStepStateSchema,
  tool: Schema.String,
});

export type AgentStep = typeof AgentStepSchema.Type;

/** What the agent did to an item. */
export const AgentCardActionSchema = Schema.Literals([
  "created",
  "updated",
  "scheduled",
  "published",
  "deleted",
  "replied",
]);

export type AgentCardAction = typeof AgentCardActionSchema.Type;

/** An item the agent made or changed, as a tool answered it. */
export const AgentCardSchema = Schema.Union([
  Schema.TaggedStruct("post", {
    action: AgentCardActionSchema,
    channelIds: Schema.Array(Schema.String),
    excerpt: Schema.String,
    postId: Schema.String,
    scheduledAt: Schema.NullOr(Schema.DateTimeUtc),
  }),
  Schema.TaggedStruct("thread", {
    action: AgentCardActionSchema,
    excerpt: Schema.String,
    threadId: Schema.String,
  }),
]);

export type AgentCard = typeof AgentCardSchema.Type;

/** Where a change the agent asked to make stands. */
export const AgentApprovalStateSchema = Schema.Literals([
  "pending",
  "approved",
  "declined",
  "expired",
  "changed",
]);

export type AgentApprovalState = typeof AgentApprovalStateSchema.Type;

/** The comment or review a change answers: who wrote it, and its start. */
export const InReplyToSchema = Schema.Struct({
  author: Schema.String,
  text: Schema.String,
});

export type InReplyTo = typeof InReplyToSchema.Type;

/** A file of the workspace's media a part shows, with its alt text. */
export const ApprovalMediaSchema = Schema.Struct({
  altText: Schema.String,
  mediaId: Schema.String,
});

/**
 * What a part has instead on one channel: its text, and the media it shows
 * there instead of the part's (null: the part's own).
 */
export const ApprovalOverrideSchema = Schema.Struct({
  channelId: Schema.String,
  media: Schema.NullOr(Schema.Array(ApprovalMediaSchema)),
  text: Schema.String,
});

/** A part after the post's first, and how long it waits after the one before. */
export const ApprovalPartSchema = Schema.Struct({
  delaySeconds: Schema.Int,
  media: Schema.Array(ApprovalMediaSchema),
  overrides: Schema.Array(ApprovalOverrideSchema),
  text: Schema.String,
});

/** A poll asked with the post's first part. */
export const ApprovalPollSchema = Schema.Struct({
  choices: Schema.Array(Schema.String),
  durationMinutes: Schema.Int,
  multipleChoice: Schema.Boolean,
});

/** A channel the post goes to, with what it sets on that platform. */
export const ApprovalTargetSchema = Schema.Struct({
  channelId: Schema.String,
  options: Schema.NullOr(Schema.Record(Schema.String, Schema.Json)),
});

/**
 * The post a change acts on, as the workspace holds it: all that goes out
 * of it on the change's channels.
 */
export const ApprovalPostSchema = Schema.Struct({
  followUps: Schema.Array(ApprovalPartSchema),
  media: Schema.Array(ApprovalMediaSchema),
  overrides: Schema.Array(ApprovalOverrideSchema),
  poll: Schema.NullOr(ApprovalPollSchema),
  shortenLinks: Schema.Boolean,
  targets: Schema.Array(ApprovalTargetSchema),
  text: Schema.String,
});

export type ApprovalPost = typeof ApprovalPostSchema.Type;

/** What a comment's moderation does, as moderate_comment takes it. */
export const ApprovalModerationSchema = Schema.Literals([
  "hide",
  "unhide",
  "like",
  "unlike",
  "delete",
]);

/** A tag a change makes, or files a post under. */
export const ApprovalTagSchema = Schema.Struct({
  colour: Schema.String,
  name: Schema.String,
});

// A field an approval kept before it was shown reads as none.
const orNone = <S extends Schema.Top>(schema: S) =>
  Schema.NullOr(schema).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null))
  );

/**
 * A change that waits for the person: all of what the call does, from its
 * parameters and what it names, as the workspace holds it. `digest` is
 * the SHA-256 of what the person was shown (`shownOf`), kept to tell,
 * when they approve, whether it still holds; never answered.
 */
export const AgentApprovalSchema = Schema.Struct({
  answered: orNone(Schema.Boolean),
  at: Schema.NullOr(Schema.DateTimeUtc),
  callId: Schema.String,
  channelIds: Schema.Array(Schema.String),
  comment: orNone(Schema.String),
  digest: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
  // The comment or review the change answers or acts on, as the workspace
  // holds it; null for none.
  inReplyTo: orNone(InReplyToSchema),
  moderation: orNone(ApprovalModerationSchema),
  part: orNone(Schema.Int),
  post: orNone(ApprovalPostSchema),
  postId: Schema.NullOr(Schema.String),
  queue: orNone(Schema.String),
  // The queue's next free slot when the change was asked, as an
  // indication: the slot is taken when the change runs, and may have
  // moved. Never part of `digest`.
  queueAt: orNone(Schema.DateTimeUtc),
  state: AgentApprovalStateSchema,
  tags: Schema.Array(ApprovalTagSchema).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([]))
  ),
  text: Schema.NullOr(Schema.String),
  threadId: Schema.NullOr(Schema.String),
  tool: Schema.String,
});

export type AgentApproval = typeof AgentApprovalSchema.Type;

/** A file of the workspace's media library attached to a person's message. */
export const AgentMediaSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["image", "video", "document", "audio"]),
  name: Schema.NullOr(Schema.String),
});

export type AgentMedia = typeof AgentMediaSchema.Type;

/**
 * A skill the person picked for a message, as it was named when they sent
 * it: it still shows once the skill is renamed or deleted.
 */
export const AgentMessageSkillSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

export type AgentMessageSkill = typeof AgentMessageSkillSchema.Type;

/** How the person rated an answer. */
export const AgentRatingSchema = Schema.Literals(["up", "down"]);

export type AgentRating = typeof AgentRatingSchema.Type;

/** How a run ended. */
export const AgentOutcomeSchema = Schema.Literals([
  "answered",
  "awaitingApproval",
  "stopped",
  "stepLimit",
  "failed",
]);

export type AgentOutcome = typeof AgentOutcomeSchema.Type;

/** Why a run failed once its events had started. */
export const AgentFailureSchema = Schema.Literals([
  "providerRefused",
  "unreachable",
  "timedOut",
  "unusableAnswer",
  "allowanceReached",
  "failed",
]);

export type AgentFailure = typeof AgentFailureSchema.Type;

/** Who answers: the workspace's own text provider, or the server's model. */
export const AgentSourceSchema = Schema.Literals(["workspace", "server"]);

export type AgentSource = typeof AgentSourceSchema.Type;

/** Why the agent is off for a person. */
export const AgentOffReasonSchema = Schema.Literals([
  "noModel",
  "paymentMethod",
]);

export type AgentOffReason = typeof AgentOffReasonSchema.Type;

/** Whether the agent answers a person in a workspace, and who. */
export interface AgentAvailability {
  readonly available: boolean;
  readonly reason: AgentOffReason | null;
  readonly source: AgentSource | null;
}
