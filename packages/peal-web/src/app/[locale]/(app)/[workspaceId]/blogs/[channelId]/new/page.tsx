import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ArticleScreen } from "#components/articles/article-screen.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// Writes a new article for the blog's website.
const NewArticlePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/blogs/[channelId]/new">) => {
  const { channelId, locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  return (
    <div className="flex flex-col gap-8">
      <ArticleScreen
        articleId={undefined}
        channelId={channelId}
        permissions={membership.permissions}
        workspaceId={membership.id}
      />
    </div>
  );
};

export const generateMetadata = workspacePageTitle("newArticle");

export default NewArticlePage;
