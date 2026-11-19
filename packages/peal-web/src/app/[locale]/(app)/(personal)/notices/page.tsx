import { Option } from "effect";
import { SettingsIcon } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { buttonVariants } from "peal-ui/components/button";

import { currentUser } from "#auth/session.ts";
import { NoticeList } from "#components/notices/notice-list.tsx";
import { PageActions } from "#components/shell/frame-view.tsx";
import { Link, redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";

// The signed-in user's notices, across their workspaces, which the list
// names from GET /api/me. Anyone signed out is sent to sign in.
const NoticesPage = async ({ params }: PageProps<"/[locale]/notices">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const t = await getTranslations("Notices.page");

  const workspaces = Object.fromEntries(
    me.value.workspaces.map(({ id, name }) => [id, name])
  );

  return (
    <>
      <PageActions>
        <Link
          href="/notices/preferences"
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <SettingsIcon aria-hidden />
          {t("preferences")}
        </Link>
      </PageActions>
      <NoticeList workspaces={workspaces} />
    </>
  );
};

export default NoticesPage;
