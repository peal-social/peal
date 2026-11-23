import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SettingsCard, SettingsCardBody } from "peal-ui/components/settings";

import { captchaSiteKey } from "#auth/captcha.ts";
import { needsPassword } from "#auth/password-state.ts";
import { currentUser } from "#auth/session.ts";
import { ConnectedAppsList } from "#components/account/connected-apps-list.tsx";
import { PasswordRow } from "#components/account/password-row.tsx";
import { SessionsList } from "#components/account/sessions-list.tsx";
import { SetPassword } from "#components/account/set-password.tsx";
import { TwoStepSection } from "#components/account/two-step-section.tsx";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// How the signed-in person gets in, in every workspace's settings: their
// password, two-step verification, the sessions signed in, and the
// applications acting for them.
const AccountSecurityPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/account/security">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  const { user } = me.value;
  const t = await getTranslations("AccountSettings");
  const twoStep = await getTranslations("TwoStep");
  const passwordless = needsPassword(user);

  const siteKey = passwordless
    ? Option.getOrNull(await captchaSiteKey())
    : null;

  return (
    <>
      {passwordless ? (
        <SettingsGroup
          title={t("password.setTitle")}
          description={t("password.description")}
        >
          <SettingsCard>
            <SettingsCardBody>
              <SetPassword
                captchaSiteKey={siteKey}
                email={user.email}
                lead={t("password.setDescription")}
              />
            </SettingsCardBody>
          </SettingsCard>
        </SettingsGroup>
      ) : (
        <SettingsGroup>
          <SettingsCard>
            <PasswordRow />
          </SettingsCard>
        </SettingsGroup>
      )}
      <SettingsGroup title={twoStep("title")} description={twoStep("about")}>
        <SettingsCard>
          <SettingsCardBody>
            {passwordless ? (
              <p className="text-muted-foreground text-sm">
                {t("password.neededFirst")}
              </p>
            ) : (
              <TwoStepSection emailVerified={user.emailVerified} />
            )}
          </SettingsCardBody>
        </SettingsCard>
      </SettingsGroup>
      <SettingsGroup
        title={t("sessions.title")}
        description={t("sessions.description")}
      >
        {/* The server lists no session to staff acting as the member:
            each comes with its token. */}
        {me.value.impersonatedBy === null ? (
          <SessionsList />
        ) : (
          <SettingsCard>
            <SettingsCardBody>
              <p className="text-muted-foreground text-sm">
                {t("sessions.impersonating")}
              </p>
            </SettingsCardBody>
          </SettingsCard>
        )}
      </SettingsGroup>
      <SettingsGroup
        title={t("apps.title")}
        description={t("apps.description")}
      >
        <ConnectedAppsList />
      </SettingsGroup>
    </>
  );
};

export const generateMetadata = workspacePageTitle("accountSecurity");

export default AccountSecurityPage;
