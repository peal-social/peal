import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AnalyticsScreen } from "#components/analytics/analytics-screen.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

// How the workspace's posts did on their platforms, for members who may
// read its analytics. `?period=7`, `30` or `90` picks the days it shows.
const AnalyticsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/analytics">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (!membership.permissions.includes("analytics:read")) {
    notFound();
  }

  return <AnalyticsScreen workspaceId={membership.id} />;
};

export default AnalyticsPage;
