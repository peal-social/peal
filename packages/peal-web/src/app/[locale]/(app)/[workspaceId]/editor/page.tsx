import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { EditorScreen } from "#components/studio/editor-screen.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// The Studio's editor, for members who may compose a video into the
// library (assistant:use and media:upload, as the slide videos' endpoint
// asks): not-found for anyone else.
const EditorPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/editor">) => {
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

  const may = new Set(workspace.permissions);

  if (!may.has("assistant:use") || !may.has("media:upload")) {
    notFound();
  }

  return (
    <EditorScreen
      workspaceId={workspace.id}
      mayConfigure={may.has("assistant:configure")}
    />
  );
};

export const generateMetadata = workspacePageTitle("editor");

export default EditorPage;
