import { Layer } from "effect";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import { AgentSkillDesk } from "#agent/application/agent-skill-desk.ts";
import { AgentRetentionCron } from "#agent/infrastructure/crons.ts";
import { DrizzleAgentChatsLive } from "#agent/infrastructure/drizzle-agent-chats.ts";
import { DrizzleAgentSkillsLive } from "#agent/infrastructure/drizzle-agent-skills.ts";
import { LanguageModelAgentRunsLive } from "#agent/infrastructure/language-model-agent-runs.ts";
import { LibraryAttachedFilesLive } from "#agent/infrastructure/library-attached-files.ts";

export { AgentDesk } from "#agent/application/agent-desk.ts";

export { AgentRecords } from "#agent/application/agent-records.ts";

export { AgentSkillDesk } from "#agent/application/agent-skill-desk.ts";

/**
 * What the agent keeps about people, for the workspace context's exports
 * and erasures, and the retention's cron: on the agent's tables. Needs
 * `Drizzle`, which the composition root brings.
 */
export const AgentRecordsLive = AgentRecords.layer.pipe(
  Layer.provide(DrizzleAgentChatsLive),
  Layer.provide(DrizzleAgentSkillsLive)
);

/** The daily retention of chats, for the cluster. */
export const AgentCronsLive = AgentRetentionCron;

/**
 * The agent's use cases: the person's chats, and runs on effect/ai with
 * the writing assistant's model (AgentModelAccess, WritingAssistant), and
 * the skills they may use. The composition root brings `Drizzle`, `Ids`,
 * the assistant's services, and the media context's MediaLibrary (the
 * files a message attaches), and the AgentToolbox and AgentLanguageModels
 * it builds from the MCP endpoint's tools and the assistant's provider
 * packages.
 */
export const AgentDeskLive = Layer.mergeAll(
  AgentDesk.layer.pipe(
    Layer.provide(LanguageModelAgentRunsLive),
    Layer.provide(LibraryAttachedFilesLive),
    Layer.provide(DrizzleAgentChatsLive)
  ),
  AgentSkillDesk.layer
).pipe(Layer.provide(DrizzleAgentSkillsLive));
