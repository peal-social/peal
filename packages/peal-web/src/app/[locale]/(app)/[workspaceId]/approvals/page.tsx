import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { ApprovalsList } from "#components/review/approvals-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// The workspace's posts that wait for an approval, each opening on its
// page, where those who may approve decide.
const ApprovalsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/approvals">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  return <ApprovalsList workspaceId={membership.id} />;
};

export default ApprovalsPage;
