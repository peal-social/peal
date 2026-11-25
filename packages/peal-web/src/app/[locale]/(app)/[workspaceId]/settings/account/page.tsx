import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  SettingsCard,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";

import { accountClosure } from "#auth/closure.ts";
import { needsPassword } from "#auth/password-state.ts";
import { currentUser } from "#auth/session.ts";
import { DeleteAccount } from "#components/account/delete-account.tsx";
import { ExportDataRow } from "#components/account/export-data.tsx";
import { LegalHoldNotice } from "#components/account/legal-hold-notice.tsx";
import { ProfileNameRow } from "#components/account/profile-form.tsx";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// The signed-in person's profile, in every workspace's settings (the
// settings' layout checks the membership): their address and name, then
// their rights over their data, what cannot be undone last.
const ProfilePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/account">) => {
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
  const settings = await getTranslations("Settings");
  // What this server keeps of a closed account for the law, if anything.
  const { legalHold } = await accountClosure();
  const passwordless = needsPassword(user);

  return (
    <>
      <SettingsGroup>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowText>
              <SettingsRowLabel>{t("profile.email")}</SettingsRowLabel>
              <SettingsRowDescription>
                {t("profile.emailHint")}
              </SettingsRowDescription>
            </SettingsRowText>
            <SettingsRowControl>
              <span className="text-sm">{user.email}</span>
            </SettingsRowControl>
          </SettingsRow>
          <ProfileNameRow name={user.name} />
        </SettingsCard>
      </SettingsGroup>
      <SettingsGroup title={t("export.title")}>
        <SettingsCard>
          <ExportDataRow
            description={
              legalHold === null
                ? t("export.description")
                : `${t("export.description")} ${t("legalHold.exported")}`
            }
          />
        </SettingsCard>
      </SettingsGroup>
      <SettingsGroup title={settings("dangerZone")}>
        <SettingsCard>
          <SettingsRow>
            <SettingsRowText>
              <SettingsRowLabel>{t("delete.title")}</SettingsRowLabel>
              <SettingsRowDescription>
                {passwordless
                  ? `${t("delete.description")} ${t("password.neededFirst")}`
                  : t("delete.description")}
              </SettingsRowDescription>
            </SettingsRowText>
            {passwordless ? null : (
              <SettingsRowControl>
                <DeleteAccount
                  legalHold={<LegalHoldNotice legalHold={legalHold} />}
                  userId={user.id}
                />
              </SettingsRowControl>
            )}
          </SettingsRow>
        </SettingsCard>
      </SettingsGroup>
    </>
  );
};

export const generateMetadata = workspacePageTitle("account");

export default ProfilePage;
