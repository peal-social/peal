import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { TagsSettings } from "#components/tags/tags-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A workspace's tags, for members who may read its posts. Adding, renaming,
// recolouring or deleting one takes post:update.
const TagsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/tags">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!may.has("post:read")) {
    notFound();
  }

  return (
    <TagsSettings
      workspaceId={workspace.id}
      mayManage={may.has("post:update")}
    />
  );
};

export const generateMetadata = workspacePageTitle("tags");

export default TagsPage;
