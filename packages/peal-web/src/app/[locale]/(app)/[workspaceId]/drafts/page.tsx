import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { postViewPath } from "#posts/post-list-filter.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// Drafts are a tab of Posts: an address kept from before opens it there.
const DraftsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/drafts">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return redirect({
    href: workspacePath(workspaceId, postViewPath("drafts")),
    locale,
  });
};

export default DraftsPage;
