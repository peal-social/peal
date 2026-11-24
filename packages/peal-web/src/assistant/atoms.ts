import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The workspace's connected providers and its model for each use. A change
// passes `reactivityKeys: providersChanged(workspaceId)`, which reads both
// again with the assistant's status, whose sources they change.

/** What refreshes the providers, the models and the status once a change lands. */
export const providersChanged = (workspaceId: string) => [
  `ai-providers:${workspaceId}`,
];

export const workspaceProviders = Atom.family((workspaceId: string) =>
  PealApi.query("assistant", "providers", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: providersChanged(workspaceId),
  })
);

export const workspaceModels = Atom.family((workspaceId: string) =>
  PealApi.query("assistant", "models", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: providersChanged(workspaceId),
  })
);

export const connectProvider = PealApi.mutation("assistant", "connectProvider");

export const disconnectProvider = PealApi.mutation(
  "assistant",
  "disconnectProvider"
);

/** Sends a connected provider one short request; changes nothing. */
export const testProvider = PealApi.mutation("assistant", "testProvider");

export const setModel = PealApi.mutation("assistant", "setModel");

export const unsetModel = PealApi.mutation("assistant", "unsetModel");
