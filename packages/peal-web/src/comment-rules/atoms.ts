import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The queries and mutations of a workspace's comment rules. A change
// passes `reactivityKeys: commentRulesChanged(workspaceId)`.

/** What refreshes a workspace's comment rules once a change lands. */
export const commentRulesChanged = (workspaceId: string) => [
  `comment-rules:${workspaceId}`,
];

/** The workspace's comment rules: a workspace keeps 100 going at most. */
export const workspaceCommentRules = (workspaceId: string) =>
  PealApi.query("automations.commentRules", "list", {
    headers: forWorkspace(workspaceId),
    query: { limit: 100 },
    reactivityKeys: commentRulesChanged(workspaceId),
  });

export const startCommentRule = PealApi.mutation(
  "automations.commentRules",
  "create"
);

export const updateCommentRule = PealApi.mutation(
  "automations.commentRules",
  "update"
);

export const stopCommentRule = PealApi.mutation(
  "automations.commentRules",
  "delete"
);
