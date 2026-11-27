"use client";

import { AsyncResult } from "effect/reactivity";
import { NewspaperIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Channel } from "peal-contract";
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
 * its name and its handle, opening its articles. Loading until they are
 * known, the failure when they could not be read, and, with none, how to
 * connect one.
 */
export const BlogsListView = ({
  hrefs,
  link: Link,
  onRetry,
  sites,
}: {
  readonly hrefs: BlogsHrefs;
  readonly link: ArticlesLink;
  /** Reads the websites again. */
  readonly onRetry: () => void;
  readonly sites: AsyncResult.AsyncResult<readonly Channel[], unknown>;
}) => {
  const t = useTranslations("Articles.blogs");

  if (AsyncResult.isFailure(sites)) {
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

  if (!AsyncResult.isSuccess(sites)) {
    return <BlogsLoading />;
  }

  if (sites.value.length === 0) {
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
    <ul className="bg-card divide-y rounded-lg border">
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
