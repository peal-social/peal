import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { ChannelsSettings } from "#components/channels/channels-settings.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { docsUrlConfig } from "#shell/docs-url.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// A workspace's channels: the accounts it posts to. The list loads in the
// browser, with the member's session; what the member may do comes from
// GET /api/me. Connecting one starts at New channel (`channels/new`).
const ChannelsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/channels">) => {
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
  const docsUrl = await Effect.runPromise(docsUrlConfig);

  return (
    <ChannelsSettings
      workspaceId={workspace.id}
      canConnect={may.has("channel:connect")}
      canDisconnect={may.has("channel:disconnect")}
      docsHref={
        docsUrl === null
          ? null
          : new URL(
              locale === "fr" ? "fr/guides/channels" : "guides/channels",
              docsUrl.endsWith("/") ? docsUrl : `${docsUrl}/`
            ).href
      }
    />
  );
};

export const generateMetadata = workspacePageTitle("channels");

export default ChannelsPage;
