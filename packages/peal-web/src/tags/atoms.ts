import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";
import { postsKeys } from "#posts/api.ts";

// The queries and mutations of a workspace's tags. A change to the tags
// passes `reactivityKeys: tagsChanged(workspaceId)`, which lists them again
// and reads the posts again, as deleting a tag takes it off its posts.

/** What refreshes a workspace's tags, and its posts, once a change lands. */
export const tagsChanged = (workspaceId: string) => [
  `tags:${workspaceId}`,
  ...postsKeys,
];

export const workspaceTags = Atom.family((workspaceId: string) =>
  PealApi.query("posts.tags", "list", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: [`tags:${workspaceId}`],
  })
);

export const createTag = PealApi.mutation("posts.tags", "create");

export const updateTag = PealApi.mutation("posts.tags", "update");

export const deleteTag = PealApi.mutation("posts.tags", "delete");

/** Files a post under other tags, whatever its status. */
export const tagPost = PealApi.mutation("posts", "setTags");
