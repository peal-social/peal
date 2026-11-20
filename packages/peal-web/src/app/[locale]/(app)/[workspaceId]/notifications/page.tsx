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
import { hrefOf } from "#shell/navigation.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// The signed-in person's notifications, across their workspaces, which the
// list names from GET /api/me, in the frame of the workspace the address
// names. Anyone signed out is sent to sign in; a workspace they do not
// belong to is not found.
const NotificationsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/notifications">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const workspace = workspaceAt(me.value.workspaces, workspaceId);

  if (workspace === undefined) {
    notFound();
  }

  const t = await getTranslations("Notices.page");

  const workspaces = Object.fromEntries(
    me.value.workspaces.map(({ id, name }) => [id, name])
  );

  return (
    <>
      <PageActions>
        <Link
          href={hrefOf(workspace.slug, "notificationSettings")}
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

export const generateMetadata = workspacePageTitle("notifications");

export default NotificationsPage;
