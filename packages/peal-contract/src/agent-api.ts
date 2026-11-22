import { HttpApi } from "effect/http-api";

import { AgentGroup } from "./agent.ts";

export {
  AgentApprovalAnswerSchema,
  AgentApprovalSchema,
  AgentApprovalStateSchema,
  AgentCardActionSchema,
  AgentCardSchema,
  AgentChatDetailSchema,
  AgentChatPageSchema,
  AgentChatSchema,
  AgentChatUpdateSchema,
  AgentEventSchema,
  AgentFailureSchema,
  AgentGroup,
  AgentMediaSchema,
  AgentMessageRequestSchema,
  AgentMessageSchema,
  AgentOffReasonSchema,
  AgentOutcomeSchema,
  AgentRatingRequestSchema,
  AgentRatingSchema,
  AgentSourceSchema,
  AgentStatusSchema,
  AgentStepSchema,
  AgentStepStateSchema,
  agentChatPageSize,
  maxAgentMessageMedia,
  maxAgentChatTitleLength,
  maxAgentMessageLength,
} from "./agent.ts";

export type {
  AgentApproval,
  AgentApprovalAnswer,
  AgentApprovalState,
  AgentCard,
  AgentCardAction,
  AgentChat,
  AgentChatDetail,
  AgentChatPage,
  AgentChatUpdate,
  AgentEvent,
  AgentFailure,
  AgentMedia,
  AgentMessage,
  AgentMessageRequest,
  AgentOffReason,
  AgentOutcome,
  AgentRating,
  AgentSource,
  AgentStatus,
  AgentStep,
  AgentStepState,
} from "./agent.ts";

export { AgentApprovalNotPending } from "./agent-approval-not-pending.ts";

export { AgentBusy } from "./agent-busy.ts";

export { AgentMediaRejected } from "./agent-media-rejected.ts";

export { AgentChatNotFound } from "./agent-chat-not-found.ts";

export { AgentSkillNotFound } from "./agent-skill-not-found.ts";

export {
  AgentSkillRefused,
  AgentSkillRefusalSchema,
} from "./agent-skill-refused.ts";

export type { AgentSkillRefusal } from "./agent-skill-refused.ts";

export {
  AgentMessageSkillSchema,
  AgentSkillListSchema,
  AgentSkillRequestSchema,
  AgentSkillSchema,
  AgentSkillScopeSchema,
  AgentSkillUpdateSchema,
  maxAgentMessageSkills,
  maxAgentSkillInstructionsLength,
  maxAgentSkillNameLength,
  maxAgentSkills,
} from "./agent-skill.ts";

export type {
  AgentMessageSkill,
  AgentSkill,
  AgentSkillList,
  AgentSkillRequest,
  AgentSkillScope,
  AgentSkillUpdate,
} from "./agent-skill.ts";

/**
 * The agent's endpoints, apart from `Api` (`peal-contract/agent`): the web
 * app's client derives from it, the server serves it beside `Api`, and
 * nothing else is generated from it, neither the OpenAPI document nor the
 * SDKs nor the command line, which reach Peal's tools through MCP.
 */
export class AgentApi extends HttpApi.make("peal-agent").add(AgentGroup) {}
