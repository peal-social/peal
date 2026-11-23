import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ChannelPlatformSchema } from "peal-contract";

import { currentUser } from "#auth/session.ts";
import { NewChannel } from "#components/channels/new-channel.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { docsUrlConfig } from "#shell/docs-url.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// The platform an address names, or none for a word no channel connects to.
const platformOf = (word: string) =>
  ChannelPlatformSchema.literals.find((platform) => platform === word);

export { platformPageTitle as generateMetadata } from "#shell/page-title.ts";

// One platform's form, under Channels › New channel in the breadcrumb.
const ChannelPlatformPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/channels/new/[platform]">) => {
  const { locale, platform: word, workspaceId } = await params;
  const platform = platformOf(word);

  if (!hasLocale(routing.locales, locale) || platform === undefined) {
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
      platform={platform}
    />
  );
};

export default ChannelPlatformPage;
