import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

/** What a workspace requires of its members, which every member reads. */
export const workspaceSecurity = Atom.family((workspaceId: string) =>
  PealApi.query("workspace", "security", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: [`security:${workspaceId}`],
  })
);

/** Requires two-step verification of every member, or stops requiring it. */
export const secureWorkspace = PealApi.mutation("workspace", "secure");
