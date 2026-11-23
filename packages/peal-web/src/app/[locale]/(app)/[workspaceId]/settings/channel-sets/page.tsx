import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ChannelSetsSettings } from "#components/channel-sets/channel-sets-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A workspace's channel sets, for members who may read its posts and its
// channels. Adding, changing or deleting one takes post:update.
const ChannelSetsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/channel-sets">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!(may.has("post:read") && may.has("channel:read"))) {
    notFound();
  }

  return (
    <ChannelSetsSettings
      workspaceId={workspace.id}
      mayManage={may.has("post:update")}
    />
  );
};

export const generateMetadata = workspacePageTitle("channelSets");

export default ChannelSetsPage;
