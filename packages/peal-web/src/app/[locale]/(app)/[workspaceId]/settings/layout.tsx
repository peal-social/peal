import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { SettingsPage } from "peal-ui/components/settings";

import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// The frame of a workspace's settings, whose panel's header names the open
// page (DESIGN.md, "The frame"), each page in the settings' column
// (DESIGN.md, "Settings"). The sidebar lists the pages its member may open,
// in their groups, as GET /api/me lists their permissions
// (#shell/navigation.ts).
const WorkspaceSettingsLayout = async ({
  children,
  params,
}: LayoutProps<"/[locale]/[workspaceId]/settings">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Only a member opens a workspace's settings.
  await membershipOf(locale, workspaceId);

  return <SettingsPage>{children}</SettingsPage>;
};

export default WorkspaceSettingsLayout;
