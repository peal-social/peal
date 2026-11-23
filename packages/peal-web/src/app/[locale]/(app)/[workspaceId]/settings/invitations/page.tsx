import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// Invitations are on the Members page now: an old link opens it.
const InvitationsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/invitations">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return redirect({
    href: workspacePath(workspaceId, "/settings/members"),
    locale,
  });
};

export default InvitationsPage;
