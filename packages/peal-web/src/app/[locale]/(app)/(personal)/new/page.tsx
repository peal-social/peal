import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { UpgradePrompts } from "#components/billing/upgrade-prompts.tsx";
import { CreateWorkspaceForm } from "#components/create-workspace-form.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { personalPageTitle } from "#shell/page-title.ts";

// A new workspace, which the person owns and which opens once made: the
// workspace switcher and the person's sidebar link here. The upgrade
// dialog opens where the plan refuses one more.
const NewWorkspacePage = async ({ params }: PageProps<"/[locale]/new">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/sign-in", locale });
  }

  const t = await getTranslations("AppPage");

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <p className="text-muted-foreground">{t("createDescription")}</p>
      <UpgradePrompts current={null}>
        <CreateWorkspaceForm />
      </UpgradePrompts>
    </div>
  );
};

export const generateMetadata = personalPageTitle("newWorkspace");

export default NewWorkspacePage;
