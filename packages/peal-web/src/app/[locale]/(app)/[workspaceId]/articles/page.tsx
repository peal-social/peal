import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// Articles are on the Posts page: an address kept from before opens it
// with its Type filter on articles.
const ArticlesPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/articles">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return redirect({
    href: workspacePath(workspaceId, "/posts?type=article"),
    locale,
  });
};

export default ArticlesPage;
