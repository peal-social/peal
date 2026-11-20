import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { activeWorkspaceOf } from "#auth/active-workspace.ts";
import { currentUser } from "#auth/session.ts";
import { FirstWorkspace } from "#components/first-workspace.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { setupPageTitle } from "#shell/page-title.ts";
import { homeWorkspaceOf, workspacePath } from "#shell/workspace-path.ts";
import { elidesBefore, firstNameOf } from "#workspaces/new-workspace.ts";

// `/` opens the person's workspace, for someone signed in: the one
// Better Auth keeps active on the session, else their first. Every way into
// the app lands here (signing in or up, a confirmed address, an accepted
// invitation, the OAuth pages). Someone with no workspace makes their
// first one on the setup page, its name offered after them in their
// account's language (`FirstWorkspace`), unless an invitation waits for
// them; staff acting as them are told they have none, as staff may not
// create one. Anyone signed out is sent to sign in.
const AppPage = async ({ params }: PageProps<"/[locale]">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const { impersonatedBy, user, workspaces } = me.value;
  const incoming = await headers();
  const cookie = incoming.get("cookie") ?? "";

  const active =
    workspaces.length > 1
      ? Option.getOrNull(await Effect.runPromise(activeWorkspaceOf(cookie)))
      : null;

  const home = homeWorkspaceOf(workspaces, active);

  if (home !== undefined) {
    return redirect({ href: workspacePath(home.slug), locale });
  }

  if (impersonatedBy !== null) {
    const t = await getTranslations("AppPage");

    return (
      <p className="text-muted-foreground mx-auto max-w-sm py-24 text-center text-sm">
        {t("staffNoWorkspace")}
      </p>
    );
  }

  const t = await getTranslations({
    locale: user.locale,
    namespace: "AppPage",
  });

  const first = firstNameOf(user.name);

  const name =
    first === null
      ? t("defaultNameNoOne")
      : t("defaultName", {
          elided: elidesBefore(first) ? "yes" : "no",
          name: first,
        });

  return <FirstWorkspace name={name} />;
};

export const generateMetadata = setupPageTitle;

export default AppPage;
