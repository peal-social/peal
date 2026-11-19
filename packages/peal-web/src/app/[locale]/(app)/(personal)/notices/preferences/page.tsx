import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { NotificationPreferencesForm } from "#components/notices/notification-preferences-form.tsx";
import { PageTitle } from "#components/shell/frame-view.tsx";
import { Link, redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { personalPageTitle } from "#shell/page-title.ts";

// Which notices the signed-in user also receives by email. Anyone signed
// out is sent to sign in.
const NotificationPreferencesPage = async ({
  params,
}: PageProps<"/[locale]/notices/preferences">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const t = await getTranslations("Notices.preferences");

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <Link
        href="/notices"
        className="text-muted-foreground self-start text-sm underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>
      <PageTitle>{t("title")}</PageTitle>
      <NotificationPreferencesForm />
    </div>
  );
};

export const generateMetadata = personalPageTitle("notices");

export default NotificationPreferencesPage;
