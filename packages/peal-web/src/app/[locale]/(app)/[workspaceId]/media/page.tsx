import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { canGenerateImages } from "#assistant/permissions.ts";
import { currentUser } from "#auth/session.ts";
import { MediaLibrary } from "#components/media/media-library.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// A workspace's media library, for its members: what they may do there
// decides whether they see the uploader and the delete buttons. Anyone
// signed out is sent to sign in; a workspace they do not belong to does not
// exist for them.
const MediaPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/media">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  const workspace = workspaceAt(me.value.workspaces, workspaceId);

  if (workspace === undefined) {
    notFound();
  }

  return (
    <MediaLibrary
      workspaceId={workspace.id}
      canGenerate={canGenerateImages(workspace.permissions)}
      canUpload={workspace.permissions.includes("media:upload")}
      canDelete={workspace.permissions.includes("media:delete")}
      mayConfigure={workspace.permissions.includes("assistant:configure")}
    />
  );
};

export const generateMetadata = workspacePageTitle("media");

export default MediaPage;
