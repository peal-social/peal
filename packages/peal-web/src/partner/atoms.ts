import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";
import type { CalendarDay } from "peal-contract";

import { PealApi } from "#api/client.ts";

// A workspace's partner account, as its people read and run it: the
// account and what it holds, its keys, and the workspaces it owns.

const partnerKey = (workspaceId: string) => `partner:${workspaceId}`;

const keysKey = (workspaceId: string) => `partner-keys:${workspaceId}`;

/** What refreshes the account once a change lands. */
export const partnerChanged = (workspaceId: string) => [
  partnerKey(workspaceId),
];

/** What refreshes its keys once one is created or revoked. */
export const partnerKeysChanged = (workspaceId: string) => [
  keysKey(workspaceId),
];

export const partnerOf = Atom.family((workspaceId: string) =>
  PealApi.query("partner.account", "get", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: partnerChanged(workspaceId),
  })
);

export const partnerKeysOf = Atom.family((workspaceId: string) =>
  PealApi.query("partner.account", "listKeys", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: partnerKeysChanged(workspaceId),
  })
);

/** The workspaces the account owns, the newest of them. */
export const partnerWorkspacesOf = Atom.family((workspaceId: string) =>
  PealApi.query("partner.account", "listWorkspaces", {
    headers: forWorkspace(workspaceId),
    query: {},
  })
);

/**
 * What needs attention in the newest workspaces the account owns, as
 * `partnerWorkspacesOf` lists them: the same page, in the same order.
 */
export const partnerHealthOf = Atom.family((workspaceId: string) =>
  PealApi.query("partner.account", "overview", {
    headers: forWorkspace(workspaceId),
    query: {},
  })
);

/**
 * What the account and its workspaces used over a period, a page of its
 * workspaces at a time: `before` names the page after the first.
 */
export const partnerUsageOf = (
  workspaceId: string,
  query: {
    readonly before?: string;
    readonly from: CalendarDay;
    readonly to: CalendarDay;
  }
) =>
  PealApi.query("workspace.usage", "partner", {
    headers: forWorkspace(workspaceId),
    query,
    reactivityKeys: [`billing:${workspaceId}`],
  });

export const openPartner = PealApi.mutation("partner.account", "open");

export const updatePartner = PealApi.mutation("partner.account", "update");

export const closePartner = PealApi.mutation("partner.account", "close");

export const createPartnerKey = PealApi.mutation(
  "partner.account",
  "createKey"
);

export const revokePartnerKey = PealApi.mutation(
  "partner.account",
  "revokeKey"
);
