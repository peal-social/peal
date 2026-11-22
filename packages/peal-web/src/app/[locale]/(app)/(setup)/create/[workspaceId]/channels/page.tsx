import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { UpgradePrompts } from "#components/billing/upgrade-prompts.tsx";
import { SetupCard } from "#components/setup/setup-card.tsx";
import { setupHiddenPlatformsConfig } from "#home/setup-config.ts";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { setupChannelsPageTitle } from "#shell/page-title.ts";
import { workspacePath } from "#shell/workspace-path.ts";

// A new workspace's second step, once it is made: its channels, connected
// one sign-in after the other, or skipped for later. A member who may not
// connect channels goes to the workspace's home.
const SetupChannelsPage = async ({
  params,
}: PageProps<"/[locale]/create/[workspaceId]/channels">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("channel:connect")) {
    return redirect({ href: workspacePath(membership.slug), locale });
  }

  const hidden = await Effect.runPromise(setupHiddenPlatformsConfig);

  return (
    <div className="mx-auto w-full max-w-xl py-24">
      <UpgradePrompts current={membership.id}>
        <SetupCard
          hidden={hidden}
          mayReadBilling={membership.permissions.includes("billing:read")}
          workspaceId={membership.id}
        />
      </UpgradePrompts>
    </div>
  );
};

export const generateMetadata = setupChannelsPageTitle;

export default SetupChannelsPage;
