import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { DraftsList } from "#components/posts/drafts-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// The workspace's drafts, newest first, each opening in the composer.
const DraftsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/drafts">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  return (
    <DraftsList
      canCreate={membership.permissions.includes("post:create")}
      workspaceId={membership.id}
    />
  );
};

export default DraftsPage;
