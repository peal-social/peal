import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { SkillScreen } from "#components/agent/skills-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A new skill for the agent, for members who may use it (assistant:use).
const NewSkillPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/agent/skills/new">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("assistant:use")) {
    notFound();
  }

  return <SkillScreen skillId={null} workspaceId={membership.id} />;
};

export const generateMetadata = workspacePageTitle("newSkill");

export default NewSkillPage;
