"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import { workspaceArticles, workspaceSites } from "#articles/api.ts";
import {
  ArticlesListView,
  ArticlesLoading,
} from "#components/articles/articles-list-view.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";

interface ArticlesListProps {
  readonly canCreate: boolean;
  /** The website's channel whose blog this is. */
  readonly channelId: string;
  readonly workspaceId: string;
}

const LoadedArticles = ({
  canCreate,
  channelId,
  workspaceId,
}: ArticlesListProps) => {
  const workspaceHref = useWorkspaceHref();
  const articlesQuery = workspaceArticles(workspaceId);
  const sitesQuery = workspaceSites(workspaceId);
  const articles = useAtomValue(articlesQuery);
  const sites = useAtomValue(sitesQuery);
  const refreshArticles = useAtomRefresh(articlesQuery);
  const refreshSites = useAtomRefresh(sitesQuery);

  return (
    <ArticlesListView
      articles={articles}
      canCreate={canCreate}
      channelId={channelId}
      hrefs={{
        article: (articleId) =>
          workspaceHref(workspaceId, `/blogs/${channelId}/${articleId}`),
        newArticle: workspaceHref(workspaceId, `/blogs/${channelId}/new`),
      }}
      link={Link}
      onRetry={() => {
        refreshArticles();
        refreshSites();
      }}
      sites={sites}
    />
  );
};

/**
 * A blog: its website's articles, newest first, each opening in the
 * editor. They and the websites are read with the visitor's cookies,
 * which only the browser sends, so they load once the page has hydrated:
 * the server renders the loading state, as the browser's first render
 * does.
 */
export const ArticlesList = (props: ArticlesListProps) => {
  const hydrated = useHydrated();

  return hydrated ? <LoadedArticles {...props} /> : <ArticlesLoading />;
};
