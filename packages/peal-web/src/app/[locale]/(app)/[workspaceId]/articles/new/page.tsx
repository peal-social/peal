import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// A new article is written from its blog: an address kept from before
// opens the websites' list, to choose one.
const NewArticlePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/articles/new">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return redirect({ href: workspacePath(workspaceId, "/blogs"), locale });
};

export default NewArticlePage;
