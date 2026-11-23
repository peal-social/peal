import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { currentUser } from "#auth/session.ts";
import { UpgradePrompts } from "#components/billing/upgrade-prompts.tsx";
import { CreateWorkspaceForm } from "#components/create-workspace-form.tsx";
import { SetupColumn } from "#components/setup/setup-column.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";

// Another workspace, on the setup page with its name empty: the workspace
// switcher's New workspace opens it. The person owns it, and its setup
// step (connecting its channels) opens once it is made. The upgrade
// dialog opens where the plan refuses one more.
const CreateWorkspacePage = async ({
  params,
}: PageProps<"/[locale]/create">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  return (
    <SetupColumn>
      <UpgradePrompts current={null}>
        <CreateWorkspaceForm />
      </UpgradePrompts>
    </SetupColumn>
  );
};

export { setupPageTitle as generateMetadata } from "#shell/page-title.ts";

export default CreateWorkspacePage;
