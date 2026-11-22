import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AgentChatScreen } from "#components/agent/agent-screen.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// One of the person's chats with the agent. Its messages are read in the
// browser with the person's session: nobody else reads them, so the
// server renders no part of them.
const AgentChatPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/agent/[chatId]">) => {
  const { chatId, locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("assistant:use")) {
    notFound();
  }

  return (
    <AgentChatScreen
      key={chatId}
      chatId={chatId}
      permissions={membership.permissions}
      workspaceId={membership.id}
    />
  );
};

export const generateMetadata = workspacePageTitle("agentChat");

export default AgentChatPage;
