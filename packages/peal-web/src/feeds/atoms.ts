import { Effect } from "effect";
import { Atom } from "effect/reactivity";
import { maxFeedPageSize, forWorkspace } from "peal-contract";
import type { Feed, FeedPage } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The queries and mutations of a workspace's feeds. A change passes
// `reactivityKeys: feedsChanged(workspaceId)`, which lists them again; it
// makes no post at once, as a feed's posts are made by the server's run.
// A deletion passes `feedListChanged(workspaceId)`, which lists them again
// alone: the deleted feed's items, open on the page when the answer lands,
// would be asked for again and found gone.

/** What refreshes a workspace's feeds once a change lands. */
export const feedsChanged = (workspaceId: string) => [`feeds:${workspaceId}`];

/** What lists a workspace's feeds again, and reads no feed's items. */
export const feedListChanged = (workspaceId: string) => [
  `feed-list:${workspaceId}`,
];

/** What the list of a workspace's feeds is read again for. */
export const feedListKeys = (workspaceId: string) => [
  ...feedsChanged(workspaceId),
  ...feedListChanged(workspaceId),
];

/** What a feed's items are read again for. */
export const feedItemsKeys = (workspaceId: string) => feedsChanged(workspaceId);

/** Every feed of the workspace, oldest first, read page after page. */
export const everyFeed = <E, R>(
  read: (cursor: string | undefined) => Effect.Effect<FeedPage, E, R>
): Effect.Effect<{ readonly items: readonly Feed[] }, E, R> =>
  Effect.gen(function* everyFeedPage() {
    const items: Feed[] = [];
    let cursor: string | undefined;

    do {
      const page: FeedPage = yield* read(cursor);

      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    return { items };
  });

/** The workspace's feeds, read again once one changes. */
export const workspaceFeeds = Atom.family((workspaceId: string) =>
  Atom.withReactivity(feedListKeys(workspaceId))(
    PealApi.runtime.atom(
      PealApi.use((client) =>
        everyFeed((cursor) =>
          client["automations.feeds"].list({
            headers: forWorkspace(workspaceId),
            query:
              cursor === undefined
                ? { limit: maxFeedPageSize }
                : { cursor, limit: maxFeedPageSize },
          })
        )
      )
    )
  )
);

/** A feed's newest items, never what they said. */
export const feedItems = (workspaceId: string, feedId: string) =>
  PealApi.query("automations.feeds", "items", {
    headers: forWorkspace(workspaceId),
    params: { feedId },
    reactivityKeys: feedItemsKeys(workspaceId),
  });

export const createFeed = PealApi.mutation("automations.feeds", "create");

export const updateFeed = PealApi.mutation("automations.feeds", "update");

export const deleteFeed = PealApi.mutation("automations.feeds", "delete");

export const previewFeed = PealApi.mutation("automations.feeds", "preview");
