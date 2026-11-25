"use client";

import { DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { PlugIcon, PlusIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Article, Channel } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Badge } from "peal-ui/components/badge";
import { Button, buttonVariants } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import type { ComponentType, ReactNode } from "react";

import { PageActions } from "#components/shell/frame-view.tsx";

/** A link of the page, given by the screen, so tests render the view. */
export type ArticlesLink = ComponentType<{
  readonly children: ReactNode;
  readonly className: string;
  readonly href: string;
}>;

/** Where the page's links go. */
export interface ArticlesHrefs {
  readonly article: (articleId: string) => string;
  readonly connect: string;
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

const siteName = (sites: readonly Channel[], channelId: string) => {
  const site = sites.find(({ id }) => id === channelId);

  return site === undefined
    ? channelId
    : (site.label ?? site.displayName ?? site.handle);
};

const ArticleRow = ({
  article,
  hrefs,
  link: Link,
  sites,
}: {
  readonly article: Article;
  readonly hrefs: ArticlesHrefs;
  readonly link: ArticlesLink;
  readonly sites: readonly Channel[];
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
            site: siteName(sites, article.channelId),
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

/** The header's actions: New article, or Connect a website where none is. */
export const ArticlesActions = ({
  canCreate,
  hrefs,
  link: Link,
  sites,
}: {
  readonly canCreate: boolean;
  readonly hrefs: ArticlesHrefs;
  readonly link: ArticlesLink;
  readonly sites: readonly Channel[];
}) => {
  const t = useTranslations("Articles.list");
  const className = buttonVariants({ size: "sm", variant: "ghost" });

  if (sites.length === 0) {
    return (
      <Link href={hrefs.connect} className={className}>
        <PlugIcon aria-hidden />
        {t("connect")}
      </Link>
    );
  }

  return canCreate ? (
    <Link href={hrefs.newArticle} className={className}>
      <PlusIcon aria-hidden />
      {t("new")}
    </Link>
  ) : null;
};

export interface ArticlesListViewProps {
  readonly articles: AsyncResult.AsyncResult<
    { readonly items: readonly Article[] },
    unknown
  >;
  readonly canCreate: boolean;
  readonly hrefs: ArticlesHrefs;
  readonly link: ArticlesLink;
  /** Reads the articles and the websites again. */
  readonly onRetry: () => void;
  readonly sites: AsyncResult.AsyncResult<readonly Channel[], unknown>;
}

/**
 * The workspace's articles and its websites, once read: loading until
 * both are known, so the page never says there is no website before it
 * knows, and the failure when either could not be read.
 */
export const ArticlesListView = ({
  articles,
  canCreate,
  hrefs,
  link,
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

  const { items } = articles.value;

  return (
    <div className="flex flex-col gap-4">
      <PageActions>
        <ArticlesActions
          canCreate={canCreate}
          hrefs={hrefs}
          link={link}
          sites={sites.value}
        />
      </PageActions>
      <p className="text-muted-foreground text-sm">
        {sites.value.length === 0
          ? t("noSite")
          : t("sites", { count: sites.value.length })}
      </p>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="bg-card divide-y rounded-md border px-4">
          {items.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              hrefs={hrefs}
              link={link}
              sites={sites.value}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
