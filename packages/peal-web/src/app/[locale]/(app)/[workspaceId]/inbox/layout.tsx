import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { InboxSplit } from "#components/inbox/inbox-split.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// The workspace's inbox, a split view: the comments people leave under its
// published posts, the reviews of its locations and its channels' direct
// messages listed beside the one open, for members who may read them
// (engagement:read; the messages, engagement:readMessages). Whose messages
// Peal reads is chosen in the settings (`settings/messages`).
const InboxLayout = async ({
  children,
  params,
}: LayoutProps<"/[locale]/[workspaceId]/inbox">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const may = new Set(membership.permissions);

  if (!may.has("engagement:read")) {
    notFound();
  }

  return (
    <InboxSplit
      mayChooseChannels={may.has("channel:connect")}
      mayReadMessages={may.has("engagement:readMessages")}
      workspaceId={membership.id}
    >
      {children}
    </InboxSplit>
  );
};

export default InboxLayout;
