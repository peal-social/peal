import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { CommentRulesSettings } from "#components/comment-rules/comment-rules-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A workspace's comment rules, for members who read the inbox; starting,
// pausing and stopping one takes engagement:reply, and giving one a
// private message engagement:message too.
const CommentRulesPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/comment-rules">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!may.has("engagement:read")) {
    notFound();
  }

  return (
    <CommentRulesSettings
      workspaceId={workspace.id}
      mayChange={may.has("engagement:reply")}
      mayMessage={may.has("engagement:message")}
    />
  );
};

export const generateMetadata = workspacePageTitle("commentRules");

export default CommentRulesPage;
