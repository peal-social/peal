import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AgentSettingsScreen } from "#components/agent/skills-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// The agent's settings, for members who may use it (assistant:use): the
// person's skills and the workspace's they may use, read in the browser
// with their session.
const AgentSettingsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/agent">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("assistant:use")) {
    notFound();
  }

  return <AgentSettingsScreen workspaceId={membership.id} />;
};

export const generateMetadata = workspacePageTitle("agentSettings");

export default AgentSettingsPage;
