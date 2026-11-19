import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { MessageSettingsPanel } from "#components/inbox/message-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// Whose direct messages Peal reads, for members who connect channels
// (channel:connect), and which applications may read them, for owners
// (organization:secure). The inbox lists the conversations.
const MessageSettingsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/messages">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const may = new Set(membership.permissions);

  if (!may.has("channel:connect")) {
    notFound();
  }

  return (
    <MessageSettingsPanel
      mayAllowApplications={may.has("organization:secure")}
      workspaceId={membership.id}
    />
  );
};

export default MessageSettingsPage;
