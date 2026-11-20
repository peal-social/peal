import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { buttonVariants } from "peal-ui/components/button";

import { currentUser } from "#auth/session.ts";
import { WorkspaceSecurityForm } from "#components/settings/workspace-security-form.tsx";
import { Link, redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { hrefOf } from "#shell/navigation.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// What the workspace requires of its members: every member reads it; an
// owner in person requires two-step verification, once their own account
// has it on.
const SecurityPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/security">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  const workspace = workspaceAt(me.value.workspaces, workspaceId);

  if (workspace === undefined) {
    notFound();
  }

  const t = await getTranslations("TwoStep");
  const may = new Set(workspace.permissions);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("securityAbout")}</p>
      <WorkspaceSecurityForm
        workspaceId={workspace.id}
        mayChange={
          may.has("organization:secure") && me.value.impersonatedBy === null
        }
        managesMembers={may.has("member:update")}
        ownEnabled={me.value.user.twoStepEnabled}
        accountLink={
          <Link
            href={hrefOf(workspace.slug, "account")}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("goToAccount")}
          </Link>
        }
      />
    </div>
  );
};

export const generateMetadata = workspacePageTitle("security");

export default SecurityPage;
