import { DateTime, Effect, Option } from "effect";
import { Atom } from "effect/reactivity";
import {
  isSocialChannel,
  forWorkspace,
  maxArticlePageSize,
} from "peal-contract";
import type { ArticlePage, ArticleSummary, Channel } from "peal-contract";

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

// Every article a list gives, read page after page.
const everyArticle = <E, R>(
  read: (cursor: string | undefined) => Effect.Effect<ArticlePage, E, R>
): Effect.Effect<{ readonly items: readonly ArticleSummary[] }, E, R> =>
  Effect.gen(function* everyArticlePage() {
    const items: ArticleSummary[] = [];
    let cursor: string | undefined;

    do {
      const page: ArticlePage = yield* read(cursor);

      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    return { items };
  });

interface ListQuery {
  cursor?: string;
  from?: DateTime.Utc;
  limit: number;
  to?: DateTime.Utc;
}

// What one page is asked: the cursor of the page before, and the range.
const listQueryOf = (
  cursor: string | undefined,
  range: Option.Option<{
    readonly from: DateTime.Utc;
    readonly to: DateTime.Utc;
  }>
): ListQuery => {
  const query: ListQuery = { limit: maxArticlePageSize };

  if (cursor !== undefined) {
    query.cursor = cursor;
  }

  if (Option.isSome(range)) {
    query.from = range.value.from;
    query.to = range.value.to;
  }

  return query;
};

// A workspace's articles, those scheduled in a range when the key names
// one: `<workspaceId>`, or `<workspaceId>?from=…&to=…`.
const articleLists = Atom.family((key: string) => {
  const [workspaceId = "", rest = ""] = key.split("?");
  const written = new URLSearchParams(rest);

  const at = (name: string) =>
    Option.flatMap(Option.fromNullOr(written.get(name)), DateTime.make);

  const range = Option.all({ from: at("from"), to: at("to") });

  return Atom.withReactivity(articleListKeys(workspaceId))(
    PealApi.runtime.atom(
      PealApi.use((client) =>
        everyArticle((cursor) =>
          client.articles.list({
            headers: forWorkspace(workspaceId),
            query: listQueryOf(cursor, range),
          })
        )
      )
    )
  );
});

/** Every article of the workspace, newest first, without its body. */
export const workspaceArticles = (workspaceId: string) =>
  articleLists(workspaceId);

/**
 * The workspace's articles scheduled from `from` (included) to `to`
 * (excluded), without their bodies: what the calendar shows.
 */
export const scheduledArticles = (
  workspaceId: string,
  from: DateTime.Utc,
  to: DateTime.Utc
) =>
  articleLists(
    `${workspaceId}?${new URLSearchParams({
      from: DateTime.formatIso(from),
      to: DateTime.formatIso(to),
    }).toString()}`
  );

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
