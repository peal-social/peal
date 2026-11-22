import { Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AgentHomeScreen } from "#components/agent/agent-screen.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

const decodeSkill = Schema.decodeUnknownOption(Schema.String);

// The agent, for members who may use the assistant (assistant:use): a new
// chat, its examples and the person's latest chats. The chats are the
// person's own, read in the browser with their session. `?skill=<id>`
// (a skill's "Use in chat") picks that skill in the new chat's composer.
const AgentPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/agent">) => {
  const { locale, workspaceId } = await params;
  const { skill } = await searchParams;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("assistant:use")) {
    notFound();
  }

  return (
    <AgentHomeScreen
      permissions={membership.permissions}
      skillId={Option.getOrNull(decodeSkill(skill))}
      workspaceId={membership.id}
    />
  );
};

export const generateMetadata = workspacePageTitle("agent");

export default AgentPage;
