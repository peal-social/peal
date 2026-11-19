import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ArticlesList } from "#components/articles/articles-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// The workspace's articles, for its websites, newest first.
const ArticlesPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/articles">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  return (
    <ArticlesList
      canCreate={membership.permissions.includes("post:create")}
      workspaceId={membership.id}
    />
  );
};

export default ArticlesPage;
