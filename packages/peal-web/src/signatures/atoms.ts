import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The queries and mutations of a workspace's signatures. A change passes
// `reactivityKeys: signaturesChanged(workspaceId)`, which lists them again.

/** What refreshes a workspace's signatures once a change lands. */
export const signaturesChanged = (workspaceId: string) => [
  `signatures:${workspaceId}`,
];

export const workspaceSignatures = Atom.family((workspaceId: string) =>
  PealApi.query("posts.signatures", "list", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: signaturesChanged(workspaceId),
  })
);

export const createSignature = PealApi.mutation("posts.signatures", "create");

export const updateSignature = PealApi.mutation("posts.signatures", "update");

export const deleteSignature = PealApi.mutation("posts.signatures", "delete");
