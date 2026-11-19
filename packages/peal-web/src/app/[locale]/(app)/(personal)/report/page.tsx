import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { ReportScreen } from "#components/overview/report-screen.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { personalPageTitle } from "#shell/page-title.ts";

// What went out in each of the signed-in person's workspaces and how it
// did, beside the days before, as GET /api/me/report answers it, with its
// CSV. Anyone signed out is sent to sign in.
const ReportPage = async ({ params }: PageProps<"/[locale]/report">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  return <ReportScreen />;
};

export const generateMetadata = personalPageTitle("report");

export default ReportPage;
