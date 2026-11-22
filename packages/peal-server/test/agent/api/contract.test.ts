import { describe, expect, it } from "@effect/vitest";
import { InboxModerationActionSchema as ContractModerationSchema } from "peal-contract";
import {
  agentApprovalLifetimeHours,
  AgentApprovalStateSchema as ContractApprovalStateSchema,
  AgentCardActionSchema as ContractCardActionSchema,
  AgentFailureSchema as ContractFailureSchema,
  AgentOffReasonSchema as ContractOffReasonSchema,
  AgentOutcomeSchema as ContractOutcomeSchema,
  AgentRatingSchema as ContractRatingSchema,
  AgentSourceSchema as ContractSourceSchema,
  AgentSkillRefusalSchema,
  AgentSkillScopeSchema as ContractSkillScopeSchema,
  AgentStepStateSchema as ContractStepStateSchema,
  agentChatPageSize,
  maxAgentChatTitleLength,
  maxAgentMessageLength,
  maxAgentMessageSkills,
  maxAgentSkillInstructionsLength,
  maxAgentSkillNameLength,
  maxAgentSkills,
} from "peal-contract/agent";

import {
  AgentApprovalStateSchema,
  AgentCardActionSchema,
  AgentFailureSchema,
  AgentOffReasonSchema,
  AgentOutcomeSchema,
  AgentRatingSchema,
  AgentSourceSchema,
  AgentStepStateSchema,
  ApprovalModerationSchema,
} from "#agent/domain/agent-parts.ts";
import {
  maxPickedSkills,
  maxSkillInstructionsLength,
  maxSkillNameLength,
  maxSkills,
  SkillScopeSchema,
} from "#agent/domain/agent-skill.ts";
import {
  approvalLifetimeHours,
  chatPageSize,
  maxMessageLength,
  maxTitleLength,
} from "#agent/domain/run-limits.ts";
import { SkillRefused } from "#agent/domain/skill-refused.ts";

// The api layer answers the domain's values as they are: each list and
// bound is the contract's.
describe("the agent's contract", () => {
  it("lists the states, actions, outcomes and reasons the domain knows", () => {
    expect([
      ContractStepStateSchema.literals,
      ContractCardActionSchema.literals,
      ContractApprovalStateSchema.literals,
      ContractRatingSchema.literals,
      ContractOutcomeSchema.literals,
      ContractFailureSchema.literals,
      ContractSourceSchema.literals,
      ContractOffReasonSchema.literals,
    ]).toStrictEqual([
      AgentStepStateSchema.literals,
      AgentCardActionSchema.literals,
      AgentApprovalStateSchema.literals,
      AgentRatingSchema.literals,
      AgentOutcomeSchema.literals,
      AgentFailureSchema.literals,
      AgentSourceSchema.literals,
      AgentOffReasonSchema.literals,
    ]);
  });

  it("takes messages and titles, pages chats and lets changes lapse by the domain's bounds", () => {
    expect([
      maxAgentMessageLength,
      maxAgentChatTitleLength,
      agentChatPageSize,
      agentApprovalLifetimeHours,
      ContractModerationSchema.literals,
    ]).toStrictEqual([
      maxMessageLength,
      maxTitleLength,
      chatPageSize,
      approvalLifetimeHours,
      ApprovalModerationSchema.literals,
    ]);
  });

  it("takes skills, and picks them, by the domain's bounds and scopes", () => {
    expect([
      maxAgentSkillNameLength,
      maxAgentSkillInstructionsLength,
      maxAgentMessageSkills,
      maxAgentSkills,
      ContractSkillScopeSchema.literals,
      AgentSkillRefusalSchema.literals,
    ]).toStrictEqual([
      maxSkillNameLength,
      maxSkillInstructionsLength,
      maxPickedSkills,
      maxSkills,
      SkillScopeSchema.literals,
      SkillRefused.fields.reason.literals,
    ]);
  });
});
