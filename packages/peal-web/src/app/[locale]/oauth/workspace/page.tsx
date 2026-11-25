import { Option } from "effect";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "peal-ui/components/button";

import { currentUser } from "#auth/session.ts";
import { AuthCard } from "#components/auth/auth-card.tsx";
import { TabPerson } from "#components/auth/tab-person.tsx";
import { SignInToContinue } from "#components/oauth/sign-in-to-continue.tsx";
import { WorkspacePicker } from "#components/oauth/workspace-picker.tsx";
import { Link } from "#i18n/navigation.ts";

// The workspace picker of an OAuth authorization: Better Auth sends people
// here after they signed in, with the authorization's signed query, and
// binds the client's tokens to the workspace they pick. Signed in, it
// names its person to the tab (`TabPerson`).
const OAuthWorkspacePage = async ({
  searchParams,
}: PageProps<"/[locale]/oauth/workspace">) => {
  const query = await searchParams;
  const t = await getTranslations("OAuth.workspace");
  const me = await currentUser();

  if (Option.isNone(me)) {
    return <SignInToContinue title={t("title")} query={query} />;
  }

  const { user, workspaces } = me.value;

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <TabPerson userId={user.id} />
      {workspaces.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
          <Link href="/" className={buttonVariants()}>
            {t("create")}
          </Link>
        </div>
      ) : (
        <WorkspacePicker
          workspaces={workspaces.map(({ id, name, role }) => ({
            id,
            name,
            role,
          }))}
        />
      )}
    </AuthCard>
  );
};

export default OAuthWorkspacePage;
