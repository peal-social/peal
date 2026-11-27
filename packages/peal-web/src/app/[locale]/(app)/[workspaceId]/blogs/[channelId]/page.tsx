import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ArticlesList } from "#components/articles/articles-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A blog: one of the workspace's websites, with its articles, newest first.
const BlogPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/blogs/[channelId]">) => {
  const { channelId, locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  return (
    <ArticlesList
      canCreate={membership.permissions.includes("post:create")}
      channelId={channelId}
      workspaceId={membership.id}
    />
  );
};

export const generateMetadata = workspacePageTitle("blog");

export default BlogPage;
