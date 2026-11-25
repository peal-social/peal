import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AnalyticsScreen } from "#components/analytics/analytics-screen.tsx";
import { routing } from "#i18n/routing.ts";
import { viewerOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// How the workspace's posts did on their platforms, for members who may
// read its analytics. `?period=7`, `30` or `90` picks the days it shows.
// The board is the signed-in person's: their id, from the same reading of
// the session as the workspace layout's (`currentUser`, once a request),
// keys it in the browser.
const AnalyticsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/analytics">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const { membership, userId } = await viewerOf(locale, workspaceId);

  if (!membership.permissions.includes("analytics:read")) {
    notFound();
  }

  return <AnalyticsScreen userId={userId} workspaceId={membership.id} />;
};

export const generateMetadata = workspacePageTitle("analytics");

export default AnalyticsPage;
