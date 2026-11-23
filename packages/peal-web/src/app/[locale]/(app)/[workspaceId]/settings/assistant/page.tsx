import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AiSettings } from "#components/assistant/ai-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// The assistant's settings: the AI providers the workspace connects with
// its own keys, and the model it uses for each use, for members with
// assistant:configure (owners and admins).
const AssistantSettingsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/assistant">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);

  if (!workspace.permissions.includes("assistant:configure")) {
    notFound();
  }

  return <AiSettings workspaceId={workspace.id} />;
};

export const generateMetadata = workspacePageTitle("assistant");

export default AssistantSettingsPage;
