import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { postViewPath } from "#posts/post-list-filter.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// The posts that wait for an approval are a tab of Posts, Needs approval:
// an address kept from before opens it there.
const ApprovalsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/approvals">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return redirect({
    href: workspacePath(workspaceId, postViewPath("approval")),
    locale,
  });
};

export default ApprovalsPage;
