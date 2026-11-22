import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { SkillScreen } from "#components/agent/skills-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// One of the skills the person may use, for members who may use the agent
// (assistant:use): its form, or read-only when they may not change it.
const SkillPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/agent/skills/[skillId]">) => {
  const { locale, skillId, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("assistant:use")) {
    notFound();
  }

  return <SkillScreen skillId={skillId} workspaceId={membership.id} />;
};

export const generateMetadata = workspacePageTitle("skill");

export default SkillPage;
