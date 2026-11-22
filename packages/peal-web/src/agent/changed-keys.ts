import type { AgentCard } from "peal-contract/agent";

import { inboxChanged } from "#inbox/atoms.ts";
import { postsKeys } from "#posts/api.ts";
import { queuesChanged } from "#queues/atoms.ts";
import { reviewKeys } from "#review/api.ts";

/**
 * What the rest of the app shows of an item the agent made or changed, so
 * the pages open beside the chat (the calendar, the posts, the inbox) read
 * it again once the run ends: a post's lists, approvals, queues and tags;
 * a thread's place in the inbox.
 */
export const changedKeysOf = (
  workspaceId: string,
  card: AgentCard
): readonly string[] =>
  card._tag === "post"
    ? [
        ...postsKeys,
        ...reviewKeys,
        ...queuesChanged(workspaceId),
        `tags:${workspaceId}`,
      ]
    : inboxChanged(workspaceId, card.threadId);
