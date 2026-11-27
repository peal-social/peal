import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { BlogsList } from "#components/articles/blogs-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// Blogs: the workspace's websites, each opening its articles.
const BlogsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/blogs">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  return <BlogsList workspaceId={membership.id} />;
};

export const generateMetadata = workspacePageTitle("blogs");

export default BlogsPage;
