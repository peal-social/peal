import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { QueuesSettings } from "#components/queues/queues-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A workspace's queues, for members who may read its posts and its
// channels. Adding, changing or deleting one takes post:update; moving its
// waiting posts onto its slots, post:schedule. The list's heading says what
// a queue is, and to those who may only read, why they cannot change one.
const QueuesPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/queues">) => {
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
    <QueuesSettings
      workspaceId={workspace.id}
      mayManage={may.has("post:update")}
      mayReshuffle={may.has("post:schedule")}
    />
  );
};

export const generateMetadata = workspacePageTitle("queues");

export default QueuesPage;
