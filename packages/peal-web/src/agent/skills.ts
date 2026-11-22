import { Atom } from "effect/reactivity";

import { PealAgentApi } from "#agent/client.ts";

// The person's skills in a workspace, through the agent's client: the
// list the settings page, the composer's "+" and its "/" read, and the
// changes, each of which passes `reactivityKeys: agentSkillsChanged(…)`
// to list them again.

/** What refreshes the person's skills once one changed. */
export const agentSkillsChanged = (workspaceId: string) => [
  `agent-skills:${workspaceId}`,
];

/** The skills the person may use in the workspace, by name. */
export const agentSkills = Atom.family((workspaceId: string) =>
  PealAgentApi.query("agent", "skills", {
    params: { workspaceId },
    reactivityKeys: agentSkillsChanged(workspaceId),
  })
);

export const createAgentSkill = PealAgentApi.mutation("agent", "createSkill");

export const updateAgentSkill = PealAgentApi.mutation("agent", "updateSkill");

export const deleteAgentSkill = PealAgentApi.mutation("agent", "deleteSkill");
