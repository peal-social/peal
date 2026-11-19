import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { workspaceSlugOf } from "peal-contract/workspace-slug";

import { activeWorkspaceOf } from "#auth/active-workspace.ts";
import { currentUser } from "#auth/session.ts";
import { FirstWorkspace } from "#components/first-workspace.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { homeWorkspaceOf, workspacePath } from "#shell/workspace-path.ts";
import { elidesBefore, firstNameOf } from "#workspaces/new-workspace.ts";

// `/` opens the person's workspace, for someone signed in: the one
// Better Auth keeps active on the session, else their first. Every way into
// the app lands here (signing in or up, a confirmed address, an accepted
// invitation, the OAuth pages). Someone with no workspace gets one made
// for them, named after them in their account's language
// (`FirstWorkspace`), unless an invitation waits for them; staff acting
// as them are sent to the account page instead, as they may not create
// one. Anyone signed out is sent to sign in.
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
    return redirect({ href: "/account", locale });
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

  // Its own slug first, the same on every try, so two tabs make one; a
  // random one should another workspace hold it.
  const slugs = [
    workspaceSlugOf(name, user.id.replaceAll("-", "").slice(0, 8)),
    workspaceSlugOf(name, crypto.randomUUID().replaceAll("-", "").slice(0, 8)),
  ];

  return <FirstWorkspace name={name} slugs={slugs} />;
};

export default AppPage;
