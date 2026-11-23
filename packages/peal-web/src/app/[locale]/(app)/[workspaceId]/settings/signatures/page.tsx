import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { SignaturesSettings } from "#components/signatures/signatures-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// A workspace's signatures, for members who may read its posts. Adding,
// changing or deleting one takes post:update.
const SignaturesPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/signatures">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!may.has("post:read")) {
    notFound();
  }

  return (
    <SignaturesSettings
      workspaceId={workspace.id}
      mayManage={may.has("post:update")}
    />
  );
};

export const generateMetadata = workspacePageTitle("signatures");

export default SignaturesPage;
