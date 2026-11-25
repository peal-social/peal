import { Atom } from "effect/reactivity";
import { isSocialChannel, forWorkspace } from "peal-contract";
import type { Channel } from "peal-contract";

import { PealApi } from "#api/client.ts";
import { channelsOf } from "#channels/channels-api.ts";

// The articles' queries and mutations. A mutation passes
// `reactivityKeys: articlesKeys(workspaceId)`, which refreshes the list
// and every article of the workspace. A deletion passes
// `articleListChanged(workspaceId)`, which reads the list again alone:
// the article's page, still open when the answer lands, would ask for it
// and find it gone.

/** What refreshes a workspace's articles once a change lands. */
export const articlesKeys = (workspaceId: string) => [
  `articles:${workspaceId}`,
];

/** What reads the list of a workspace's articles again, and no article. */
export const articleListChanged = (workspaceId: string) => [
  `article-list:${workspaceId}`,
];

/** What the list of a workspace's articles is read again for. */
export const articleListKeys = (workspaceId: string) => [
  ...articlesKeys(workspaceId),
  ...articleListChanged(workspaceId),
];

/** The workspace's articles, newest first. */
export const workspaceArticles = (workspaceId: string) =>
  PealApi.query("articles", "list", {
    headers: forWorkspace(workspaceId),
    query: {},
    reactivityKeys: articleListKeys(workspaceId),
  });

/** One article of the workspace. */
export const workspaceArticle = (workspaceId: string, articleId: string) =>
  PealApi.query("articles", "get", {
    headers: forWorkspace(workspaceId),
    params: { articleId },
    reactivityKeys: articlesKeys(workspaceId),
  });

/** Whether the channel is a website's, which takes articles. */
export const isSiteChannel = (channel: Channel): boolean =>
  !isSocialChannel(channel);

/** The workspace's websites: the channels articles go to. */
export const workspaceSites = Atom.family((workspaceId: string) =>
  Atom.mapResult(channelsOf(workspaceId), (channels) =>
    channels.filter(isSiteChannel)
  )
);

export const createArticle = PealApi.mutation("articles", "create");

export const updateArticle = PealApi.mutation("articles", "update");

export const deleteArticle = PealApi.mutation("articles", "delete");

export const scheduleArticle = PealApi.mutation("articles", "schedule");

export const unscheduleArticle = PealApi.mutation("articles", "unschedule");

export const retryArticle = PealApi.mutation("articles", "retry");

export const unpublishArticle = PealApi.mutation("articles", "unpublish");

export const updateArticleOnSite = PealApi.mutation("articles", "updateOnSite");
