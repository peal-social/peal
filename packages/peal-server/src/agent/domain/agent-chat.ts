import { Schema } from "effect";

import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";

import { AgentChatIdSchema } from "./ids.ts";

/**
 * A chat with the agent. It is its author's alone: nobody else in the
 * workspace reads it, staff acting as them included. `updatedAt` is when
 * its last message was written, from which its retention counts.
 */
export class AgentChat extends Schema.Class<AgentChat>(
  "peal-server/agent/domain/AgentChat"
)({
  createdAt: Schema.DateTimeUtc,
  id: AgentChatIdSchema,
  starred: Schema.Boolean,
  // None until the agent names it, after its first answer.
  title: Schema.Option(Schema.String),
  updatedAt: Schema.DateTimeUtc,
  userId: UserIdSchema,
  workspaceId: WorkspaceIdSchema,
}) {}
