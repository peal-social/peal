import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { articleSiteOf } from "#articles/server.ts";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// An article is its blog's: an address kept from before opens it there,
// or the websites' list when it cannot be read.
const ArticlePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/articles/[articleId]">) => {
  const { articleId, locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const site = await articleSiteOf(membership.id, articleId);

  return redirect({
    href: workspacePath(
      workspaceId,
      Option.match(site, {
        onNone: () => "/blogs",
        onSome: (channelId) => `/blogs/${channelId}/${articleId}`,
      })
    ),
    locale,
  });
};

export default ArticlePage;
