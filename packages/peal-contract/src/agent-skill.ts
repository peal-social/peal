import { Schema } from "effect";

// A skill is instructions a person saves for a task they repeat ("plan
// next week", "answer a review in our voice"): they pick it in a message,
// or the agent reads it when a request fits it. A personal skill is its
// author's alone; a workspace skill is every member's who may use the
// agent there.

/** The longest name a skill takes, in UTF-16 code units. */
export const maxAgentSkillNameLength = 60;

/** The longest instructions a skill takes, in UTF-16 code units. */
export const maxAgentSkillInstructionsLength = 8000;

/** The most skills a message picks. */
export const maxAgentMessageSkills = 3;

/** The most skills a person sees in a workspace: theirs and the workspace's. */
export const maxAgentSkills = 100;

/** Whose a skill is: its author's alone, or the workspace's. */
export const AgentSkillScopeSchema = Schema.Literals(["personal", "workspace"]);

export type AgentSkillScope = typeof AgentSkillScopeSchema.Type;

const name = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(maxAgentSkillNameLength)
);

const instructions = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(maxAgentSkillInstructionsLength)
);

/** A skill the person may use. */
export const AgentSkillSchema = Schema.Struct({
  createdAt: Schema.DateTimeUtc,
  // Whether the person may change or delete it: their own, or, for a
  // workspace skill, one they may manage there.
  editable: Schema.Boolean,
  id: Schema.String,
  instructions: Schema.String,
  name: Schema.String,
  scope: AgentSkillScopeSchema,
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "AgentSkill" });

export type AgentSkill = typeof AgentSkillSchema.Type;

/** The skills a person may use in a workspace, by name. */
export const AgentSkillListSchema = Schema.Struct({
  skills: Schema.Array(AgentSkillSchema),
}).annotate({ identifier: "AgentSkillList" });

export type AgentSkillList = typeof AgentSkillListSchema.Type;

/** A new skill. */
export const AgentSkillRequestSchema = Schema.Struct({
  instructions,
  name,
  scope: AgentSkillScopeSchema,
}).annotate({ identifier: "AgentSkillRequest" });

export type AgentSkillRequest = typeof AgentSkillRequestSchema.Type;

/** What changes in a skill: its name, its instructions, whose it is. */
export const AgentSkillUpdateSchema = Schema.Struct({
  instructions: Schema.optionalKey(instructions),
  name: Schema.optionalKey(name),
  scope: Schema.optionalKey(AgentSkillScopeSchema),
}).annotate({ identifier: "AgentSkillUpdate" });

export type AgentSkillUpdate = typeof AgentSkillUpdateSchema.Type;

/**
 * A skill a message picked, as it was named when it was sent: it still
 * shows once the skill is renamed or deleted.
 */
export const AgentMessageSkillSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
}).annotate({ identifier: "AgentMessageSkill" });

export type AgentMessageSkill = typeof AgentMessageSkillSchema.Type;
