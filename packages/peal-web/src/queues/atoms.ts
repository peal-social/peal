import { Atom } from "effect/reactivity";
import { maxPostPageSize, forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";
import { postListKeys } from "#posts/api.ts";

// The queries and mutations of a workspace's queues. A change passes
// `reactivityKeys: queuesChanged(workspaceId)`, which lists them again,
// with their coming slots; so does a change to the channels, as a queue
// says which of its channels are no longer connected, and a post made or
// moved, which takes or frees a slot. A deletion passes
// `queueListChanged(workspaceId)`, which lists them again alone: the
// deleted queue's slots, still on the page when the answer lands, would
// be asked for again and found gone.

/** What refreshes a workspace's queues once a change lands. */
export const queuesChanged = (workspaceId: string) => [`queues:${workspaceId}`];

/** What lists a workspace's queues again, and reads no queue's slots. */
export const queueListChanged = (workspaceId: string) => [
  `queue-list:${workspaceId}`,
];

/** What the list of a workspace's queues is read again for. */
export const queueListKeys = (workspaceId: string) => [
  ...queuesChanged(workspaceId),
  ...queueListChanged(workspaceId),
  "channels",
];

/** What a queue's slots are read again for. */
export const queueSlotsKeys = (workspaceId: string) => [
  ...queuesChanged(workspaceId),
  "posts",
];

export const workspaceQueues = Atom.family((workspaceId: string) =>
  PealApi.query("automations.queues", "list", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: queueListKeys(workspaceId),
  })
);

/** How many coming slots a queue shows where it is listed. */
export const shownSlots = 3;

/** A queue's coming slots, and the one a post added now would take. */
export const queueSlots = (
  workspaceId: string,
  queueId: string,
  count: number = shownSlots
) =>
  PealApi.query("automations.queues", "slots", {
    headers: forWorkspace(workspaceId),
    params: { queueId },
    query: { count },
    reactivityKeys: queueSlotsKeys(workspaceId),
  });

export const createQueue = PealApi.mutation("automations.queues", "create");

export const updateQueue = PealApi.mutation("automations.queues", "update");

export const deleteQueue = PealApi.mutation("automations.queues", "delete");

export const enqueuePost = PealApi.mutation("posts", "enqueue");

/** Moves a queue's waiting posts onto its slots as they now are. */
export const reshuffleQueue = PealApi.mutation(
  "automations.queues",
  "reshuffle"
);

/**
 * The queue's posts with this status, the first page of them: enough to
 * say how many wait, and whether more do.
 */
export const queuedPosts = (
  workspaceId: string,
  queueId: string,
  status: "awaitingApproval" | "scheduled"
) =>
  PealApi.query("posts", "list", {
    headers: forWorkspace(workspaceId),
    query: { limit: maxPostPageSize, queueId, status },
    reactivityKeys: [...queuesChanged(workspaceId), ...postListKeys],
  });
