import { Schema } from "effect";

import {
  AgentApprovalSchema,
  AgentCardSchema,
  AgentOutcomeSchema,
  AgentRatingSchema,
  AgentStepSchema,
} from "./agent-parts.ts";
import { AgentMessageIdSchema } from "./ids.ts";

/**
 * One message of a chat: the person's (`user`, its text as they wrote it),
 * or the agent's answer, with the steps it took, the items it made or
 * changed and the changes it asked to make.
 */
export class AgentMessage extends Schema.Class<AgentMessage>(
  "peal-server/agent/domain/AgentMessage"
)({
  approvals: Schema.Array(AgentApprovalSchema),
  cards: Schema.Array(AgentCardSchema),
  createdAt: Schema.DateTimeUtc,
  // How long the agent worked on it; none for the person's.
  durationMs: Schema.Option(Schema.Int),
  id: AgentMessageIdSchema,
  outcome: Schema.Option(AgentOutcomeSchema),
  rating: Schema.Option(AgentRatingSchema),
  role: Schema.Literals(["user", "assistant"]),
  steps: Schema.Array(AgentStepSchema),
  text: Schema.String,
}) {}
