import { Layer } from "effect";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import { AgentRetentionCron } from "#agent/infrastructure/crons.ts";
import { DrizzleAgentChatsLive } from "#agent/infrastructure/drizzle-agent-chats.ts";
import { LanguageModelAgentRunsLive } from "#agent/infrastructure/language-model-agent-runs.ts";

export { AgentDesk } from "#agent/application/agent-desk.ts";

export { AgentRecords } from "#agent/application/agent-records.ts";

/**
 * What the agent keeps about people, for the workspace context's exports
 * and erasures, and the retention's cron: on the agent's tables. Needs
 * `Drizzle`, which the composition root brings.
 */
export const AgentRecordsLive = AgentRecords.layer.pipe(
  Layer.provide(DrizzleAgentChatsLive)
);

/** The daily retention of chats, for the cluster. */
export const AgentCronsLive = AgentRetentionCron;

/**
 * The agent's use cases: the person's chats, and runs on effect/ai with
 * the writing assistant's model (AgentModelAccess, WritingAssistant). The
 * composition root brings `Drizzle`, `Ids`, the assistant's services, and
 * the AgentToolbox and AgentLanguageModels it builds from the MCP
 * endpoint's tools and the assistant's provider packages.
 */
export const AgentDeskLive = AgentDesk.layer.pipe(
  Layer.provide(LanguageModelAgentRunsLive),
  Layer.provide(DrizzleAgentChatsLive)
);
