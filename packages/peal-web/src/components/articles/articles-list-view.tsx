"use client";

import { DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Article, Channel } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Badge } from "peal-ui/components/badge";
import { Button, buttonVariants } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import type { ComponentType, ReactNode } from "react";

import { channelTitle } from "#channels/channel-name.ts";
import { PageActions, PageTitle } from "#components/shell/frame-view.tsx";

/** A link of the page, given by the screen, so tests render the view. */
export type ArticlesLink = ComponentType<{
  readonly children: ReactNode;
  readonly className: string;
  readonly href: string;
}>;

/** Where the page's links go. */
export interface ArticlesHrefs {
  readonly article: (articleId: string) => string;
  readonly newArticle: string;
}

const badgeVariant = {
  draft: "outline",
  failed: "destructive",
  published: "default",
  publishing: "secondary",
  scheduled: "secondary",
  unconfirmed: "destructive",
} as const;

const ArticleRow = ({
  article,
  hrefs,
  link: Link,
}: {
  readonly article: Article;
  readonly hrefs: ArticlesHrefs;
  readonly link: ArticlesLink;
}) => {
  const t = useTranslations("Articles.list");
  const format = useFormatter();

  const removed =
    article.state._tag === "published" && article.state.removedAt !== null;

  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={hrefs.article(article.id)}
          className="truncate font-medium hover:underline"
        >
          {article.title.trim() === "" ? t("untitled") : article.title}
        </Link>
        <span className="text-muted-foreground truncate text-sm">
          {t("meta", {
            updated: format.dateTime(DateTime.toDateUtc(article.updatedAt), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </span>
      </div>
      <Badge variant={badgeVariant[article.state._tag]}>
        {removed ? t("removed") : t(`state.${article.state._tag}`)}
      </Badge>
    </li>
  );
};

/** The page's loading state: before hydration, and until it knows. */
export const ArticlesLoading = () => {
  const t = useTranslations("Articles.list");

  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
};

export interface ArticlesListViewProps {
  /** Every article of the workspace, whose blog's the page keeps. */
  readonly articles: AsyncResult.AsyncResult<
    { readonly items: readonly Article[] },
    unknown
  >;
  readonly canCreate: boolean;
  /** The website's channel whose blog this is. */
  readonly channelId: string;
  readonly hrefs: ArticlesHrefs;
  readonly link: ArticlesLink;
  /** Reads the articles and the websites again. */
  readonly onRetry: () => void;
  readonly sites: AsyncResult.AsyncResult<readonly Channel[], unknown>;
}

/**
 * A blog: its website's articles, newest first, once read, under the
 * website's name. Loading until the articles and the websites are known,
 * the failure when either could not be read, and a line saying so when
 * the website is not one of the workspace's.
 */
export const ArticlesListView = ({
  articles,
  canCreate,
  channelId,
  hrefs,
  link: Link,
  onRetry,
  sites,
}: ArticlesListViewProps) => {
  const t = useTranslations("Articles.list");

  if (AsyncResult.isFailure(articles) || AsyncResult.isFailure(sites)) {
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

  if (!AsyncResult.isSuccess(articles) || !AsyncResult.isSuccess(sites)) {
    return <ArticlesLoading />;
  }

  const site = sites.value.find(({ id }) => id === channelId);

  if (site === undefined) {
    return (
      <Alert>
        <AlertDescription>{t("siteNotFound")}</AlertDescription>
      </Alert>
    );
  }

  const items = articles.value.items.filter(
    (article) => article.channelId === channelId
  );

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{channelTitle(site)}</PageTitle>
      {canCreate ? (
        <PageActions>
          <Link
            href={hrefs.newArticle}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            <PlusIcon aria-hidden />
            {t("new")}
          </Link>
        </PageActions>
      ) : null}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-md border px-4">
          {items.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              hrefs={hrefs}
              link={Link}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
