import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { NewChannel } from "#components/channels/new-channel.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { docsUrlConfig } from "#shell/docs-url.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// Where a member picks a platform and connects an account on it. The
// platforms this server connects load in the browser, with the member's
// session.
const NewChannelPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/channels/new">) => {
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

  const docsUrl = await Effect.runPromise(docsUrlConfig);

  return (
    <NewChannel
      workspaceId={workspace.id}
      canConnect={workspace.permissions.includes("channel:connect")}
      docsUrl={docsUrl}
    />
  );
};

export const generateMetadata = workspacePageTitle("newChannel");

export default NewChannelPage;
