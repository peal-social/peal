import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { privacyUrlConfig } from "#billing/terms.ts";
import { WorkspaceHome } from "#components/home/workspace-home.tsx";
import { ConsentCard } from "#components/measurement/consent-controls.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { hrefOf } from "#shell/navigation.ts";

// The workspace's home: the question about the web app's measurement while
// the person has not answered it, connecting channels and assistants, and
// a quickstart for an agent or an app.
const WorkspaceHomePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);
  const privacyUrl = await Effect.runPromise(privacyUrlConfig);

  return (
    <div className="flex flex-col gap-8">
      <ConsentCard privacyUrl={privacyUrl} />
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

export default WorkspaceHomePage;
