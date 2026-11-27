"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";

import { workspaceSites } from "#articles/api.ts";
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
  const sites = useAtomValue(sitesQuery);
  const refresh = useAtomRefresh(sitesQuery);

  return (
    <BlogsListView
      hrefs={{
        blog: (channelId) => workspaceHref(workspaceId, `/blogs/${channelId}`),
        connect: workspaceHref(workspaceId, "/channels"),
      }}
      link={Link}
      onRetry={refresh}
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
