"use client";

import { AsyncResult } from "effect/reactivity";
import { NewspaperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Article, Channel } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button, buttonVariants } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import { Skeleton } from "peal-ui/components/skeleton";

import { channelTitle } from "#channels/channel-name.ts";
import type { ArticlesLink } from "#components/articles/articles-list-view.tsx";
import { PlatformMark } from "#components/channels/platform-mark.tsx";

/** Where the page's links go. */
export interface BlogsHrefs {
  /** A website's blog: its articles. */
  readonly blog: (channelId: string) => string;
  /** The Channels page, where a website is connected. */
  readonly connect: string;
}

/** The page's loading state: before hydration, and until it knows. */
export const BlogsLoading = () => {
  const t = useTranslations("Articles.blogs");

  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
};

/**
 * Blogs: the workspace's websites, each a row with its platform's mark,
 * its name and its handle, opening its articles, and a row for each
 * website disconnected since whose articles stay. Loading until they are
 * known, the failure when they could not be read, and, with none, how to
 * connect one.
 */
export const BlogsListView = ({
  articles,
  hrefs,
  link: Link,
  onRetry,
  sites,
}: {
  /** Every article of the workspace, for the websites disconnected since. */
  readonly articles: AsyncResult.AsyncResult<
    { readonly items: readonly Article[] },
    unknown
  >;
  readonly hrefs: BlogsHrefs;
  readonly link: ArticlesLink;
  /** Reads the websites and the articles again. */
  readonly onRetry: () => void;
  readonly sites: AsyncResult.AsyncResult<readonly Channel[], unknown>;
}) => {
  const t = useTranslations("Articles.blogs");
  const tPosts = useTranslations("Posts");

  if (AsyncResult.isFailure(sites) || AsyncResult.isFailure(articles)) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Alert variant="destructive">
          <AlertDescription>{t("loadFailed")}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!AsyncResult.isSuccess(sites) || !AsyncResult.isSuccess(articles)) {
    return <BlogsLoading />;
  }

  // The websites disconnected since (or connected again, under a new
  // channel) whose articles stay: one row each, with how many.
  const connected = new Set(sites.value.map(({ id }) => id));
  const kept = new Map<string, number>();

  for (const { channelId } of articles.value.items) {
    if (!connected.has(channelId)) {
      kept.set(channelId, (kept.get(channelId) ?? 0) + 1);
    }
  }

  if (sites.value.length === 0 && kept.size === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={<NewspaperIcon />} />
        <EmptyStateTitle>{t("emptyTitle")}</EmptyStateTitle>
        <EmptyStateDescription>{t("empty")}</EmptyStateDescription>
        <EmptyStateActions>
          <Link href={hrefs.connect} className={buttonVariants()}>
            {t("connect")}
          </Link>
        </EmptyStateActions>
      </EmptyState>
    );
  }

  return (
    <ul className="bg-card divide-y rounded-xl border">
      {[...kept].map(([channelId, count]) => (
        <li key={channelId}>
          <Link
            href={hrefs.blog(channelId)}
            className="hover:bg-accent flex min-w-0 items-center gap-3 px-4 py-3"
          >
            <span className="text-muted-foreground truncate text-sm font-medium">
              {tPosts("disconnectedChannel")}
            </span>
            <span className="text-muted-foreground truncate text-sm">
              {t("articleCount", { count })}
            </span>
          </Link>
        </li>
      ))}
      {sites.value.map((site) => (
        <li key={site.id}>
          <Link
            href={hrefs.blog(site.id)}
            className="hover:bg-accent flex min-w-0 items-center gap-3 px-4 py-3"
          >
            <PlatformMark platform={site.platform} />
            <span className="truncate text-sm font-medium">
              {channelTitle(site)}
            </span>
            <span className="text-muted-foreground truncate text-sm">
              {site.handle}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
