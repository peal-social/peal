import { Schema } from "effect";

import { Uuid7Schema } from "#shared/domain/ids.ts";

/** A chat with the agent: one person's, in one workspace. */
export const AgentChatIdSchema = Uuid7Schema.pipe(Schema.brand("AgentChatId"));

export type AgentChatId = typeof AgentChatIdSchema.Type;

/** A message of a chat: the person's, or the agent's answer. */
export const AgentMessageIdSchema = Uuid7Schema.pipe(
  Schema.brand("AgentMessageId")
);

export type AgentMessageId = typeof AgentMessageIdSchema.Type;

/** A skill: its author's own, or the workspace's. */
export const AgentSkillIdSchema = Uuid7Schema.pipe(
  Schema.brand("AgentSkillId")
);

export type AgentSkillId = typeof AgentSkillIdSchema.Type;
