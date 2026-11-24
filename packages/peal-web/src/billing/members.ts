import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

/** The workspace's members, as every member in person may list them. */
export const membersOf = Atom.family((workspaceId: string) =>
  PealApi.query("workspace.members", "list", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: [`members:${workspaceId}`],
  })
);

/**
 * Where the workspace stands against its plan, with its billing account,
 * for every member: the over-plan screen reads it, and the upgrade dialog
 * names the workspace that bills from it.
 */
export const standingOf = Atom.family((workspaceId: string) =>
  PealApi.query("workspace.billing", "standing", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: [`billing:${workspaceId}`],
  })
);

/** Keeps what a member chose in a workspace over its plan. */
export const reduceWorkspace = PealApi.mutation(
  "workspace.billingActions",
  "reduce"
);

// The roles whose members order a plan (billing:manage).
const managing: ReadonlySet<string> = new Set(["admin", "owner"]);

/** Whether a member with this role, as it is stored, manages billing. */
export const managesBilling = (role: string): boolean =>
  role.split(",").some((name) => managing.has(name.trim()));
