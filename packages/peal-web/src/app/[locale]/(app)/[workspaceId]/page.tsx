import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { privacyUrlConfig } from "#billing/terms.ts";
import { SetupCard } from "#components/home/setup-card.tsx";
import { WorkspaceHome } from "#components/home/workspace-home.tsx";
import { ConsentCard } from "#components/measurement/consent-controls.tsx";
import { setupHiddenPlatformsConfig } from "#home/setup-config.ts";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { hrefOf } from "#shell/navigation.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// The workspace's home: the question about the web app's measurement while
// the person has not answered it, the setup card while a new workspace has
// no channel, connecting channels and assistants, and a quickstart for an
// agent or an app.
const WorkspaceHomePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const privacyUrl = await Effect.runPromise(privacyUrlConfig);
  const hidden = await Effect.runPromise(setupHiddenPlatformsConfig);

  return (
    <div className="flex flex-col gap-8">
      <ConsentCard privacyUrl={privacyUrl} />
      {membership.permissions.includes("channel:connect") ? (
        <SetupCard
          hidden={hidden}
          mayReadBilling={membership.permissions.includes("billing:read")}
          workspaceId={membership.id}
        />
      ) : null}
      <WorkspaceHome
        channelsHref={hrefOf(membership.slug, "channels")}
        keysHref={
          membership.permissions.includes("apiKey:read")
            ? hrefOf(membership.slug, "apiKeys")
            : null
        }
      />
    </div>
  );
};

export const generateMetadata = workspacePageTitle("home");

export default WorkspaceHomePage;
