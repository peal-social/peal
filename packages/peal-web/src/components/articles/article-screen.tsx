"use client";

import { useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import type { Article, Channel } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";

import { workspaceArticle, workspaceSites } from "#articles/api.ts";
import { ArticleEditor } from "#components/articles/article-editor.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";

interface ArticleScreenProps {
  /** The article to edit; none for a new one. */
  readonly articleId: string | undefined;
  /** The website's channel whose blog the address names. */
  readonly channelId: string;
  readonly permissions: readonly string[];
  readonly workspaceId: string;
}

interface LoadedProps {
  readonly article: Article | undefined;
  readonly channelId: string;
  readonly permissions: readonly string[];
  readonly sites: readonly Channel[];
  readonly workspaceId: string;
}

const Loaded = ({
  article,
  channelId,
  permissions,
  sites,
  workspaceId,
}: LoadedProps) => (
  <ArticleEditor
    // A new answer of the server starts the editor over on it.
    key={
      article === undefined
        ? "new"
        : `${article.id}:${DateTime.toEpochMillis(article.updatedAt)}`
    }
    {...(article === undefined ? {} : { article })}
    channelId={channelId}
    permissions={permissions}
    sites={sites}
    workspaceId={workspaceId}
  />
);

const ExistingArticle = ({
  articleId,
  ...props
}: Omit<LoadedProps, "article"> & { readonly articleId: string }) => {
  const t = useTranslations("Articles");
  const article = useAtomValue(workspaceArticle(props.workspaceId, articleId));

  if (AsyncResult.isFailure(article)) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t("notFound")}</AlertDescription>
      </Alert>
    );
  }

  return AsyncResult.isSuccess(article) ? (
    <Loaded article={article.value} {...props} />
  ) : null;
};

const LoadedArticleScreen = ({
  articleId,
  channelId,
  permissions,
  workspaceId,
}: ArticleScreenProps) => {
  const t = useTranslations("Articles");
  const sites = useAtomValue(workspaceSites(workspaceId));

  if (!AsyncResult.isSuccess(sites)) {
    return null;
  }

  if (articleId !== undefined) {
    return (
      <ExistingArticle
        articleId={articleId}
        channelId={channelId}
        permissions={permissions}
        sites={sites.value}
        workspaceId={workspaceId}
      />
    );
  }

  return sites.value.some(({ id }) => id === channelId) ? (
    <Loaded
      article={undefined}
      channelId={channelId}
      permissions={permissions}
      sites={sites.value}
      workspaceId={workspaceId}
    />
  ) : (
    <Alert>
      <AlertDescription>{t("list.siteNotFound")}</AlertDescription>
    </Alert>
  );
};

/**
 * Loads the workspace's websites, and the article, for the editor; a new
 * article starts on the blog's website. Both are read with the visitor's
 * cookies, which only the browser sends, so they load once the page has
 * hydrated, as the browser's first render shows nothing either.
 */
export const ArticleScreen = (props: ArticleScreenProps) => {
  const hydrated = useHydrated();

  return hydrated ? <LoadedArticleScreen {...props} /> : null;
};
