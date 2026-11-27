"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import { workspaceArticles, workspaceSites } from "#articles/api.ts";
import { blogPathOf } from "#articles/blog-paths.ts";
import {
  BlogsListView,
  BlogsLoading,
} from "#components/articles/blogs-list-view.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";

const LoadedBlogs = ({ workspaceId }: { readonly workspaceId: string }) => {
  const workspaceHref = useWorkspaceHref();
  const sitesQuery = workspaceSites(workspaceId);
  const articlesQuery = workspaceArticles(workspaceId);
  const sites = useAtomValue(sitesQuery);
  const articles = useAtomValue(articlesQuery);
  const refreshSites = useAtomRefresh(sitesQuery);
  const refreshArticles = useAtomRefresh(articlesQuery);

  return (
    <BlogsListView
      articles={articles}
      hrefs={{
        blog: (channelId) => workspaceHref(workspaceId, blogPathOf(channelId)),
        connect: workspaceHref(workspaceId, "/channels"),
      }}
      link={Link}
      onRetry={() => {
        refreshSites();
        refreshArticles();
      }}
      sites={sites}
    />
  );
};

/**
 * Blogs: the workspace's websites, each opening its articles. They are
 * read with the visitor's cookies, which only the browser sends, so they
 * load once the page has hydrated: the server renders the loading state,
 * as the browser's first render does.
 */
export const BlogsList = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const hydrated = useHydrated();

  return hydrated ? (
    <LoadedBlogs workspaceId={workspaceId} />
  ) : (
    <BlogsLoading />
  );
};
