import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import type { ReactNode } from "react";

import { captchaSiteKey } from "#auth/captcha.ts";
import { accountClosure } from "#auth/closure.ts";
import { needsPassword } from "#auth/password-state.ts";
import { currentUser } from "#auth/session.ts";
import { ConnectedAppsList } from "#components/account/connected-apps-list.tsx";
import { DeleteAccount } from "#components/account/delete-account.tsx";
import { ExportData } from "#components/account/export-data.tsx";
import { LanguageForm } from "#components/account/language-form.tsx";
import { LegalHoldNotice } from "#components/account/legal-hold-notice.tsx";
import { PasswordForm } from "#components/account/password-form.tsx";
import { ProfileForm } from "#components/account/profile-form.tsx";
import { SessionsList } from "#components/account/sessions-list.tsx";
import { SetPassword } from "#components/account/set-password.tsx";
import { TimeFormatForm } from "#components/account/time-format-form.tsx";
import { TwoStepSection } from "#components/account/two-step-section.tsx";
import { ConsentSetting } from "#components/measurement/consent-controls.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

const Section = ({
  children,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>
        <h2>{title}</h2>
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

// The signed-in person's account, in every workspace's settings (the
// settings' layout checks the membership): their name and language,
// password, sessions, connected applications, and their rights over their
// data.
const AccountPage = async ({
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
  const twoStep = await getTranslations("TwoStep");
  const measurement = await getTranslations("Measurement.setting");
  // What this server keeps of a closed account for the law, if anything.
  const { legalHold } = await accountClosure();
  const passwordless = needsPassword(user);

  const siteKey = passwordless
    ? Option.getOrNull(await captchaSiteKey())
    : null;

  // One action, in the password's section, so a captcha shows once.
  const passwordFirst = (
    <p className="text-muted-foreground text-sm">{t("password.neededFirst")}</p>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Section
        title={t("profile.title")}
        description={t("profile.description")}
      >
        <ProfileForm name={user.name} />
      </Section>
      <Section
        title={t("language.title")}
        description={t("language.description")}
      >
        <LanguageForm saved={user.locale} />
      </Section>
      <Section
        title={t("timeFormat.title")}
        description={t("timeFormat.description")}
      >
        <TimeFormatForm />
      </Section>
      {passwordless ? (
        <Section
          title={t("password.setTitle")}
          description={t("password.description")}
        >
          <SetPassword
            captchaSiteKey={siteKey}
            email={user.email}
            lead={t("password.setDescription")}
          />
        </Section>
      ) : (
        <Section
          title={t("password.title")}
          description={t("password.description")}
        >
          <PasswordForm />
        </Section>
      )}
      <Section title={twoStep("title")} description={twoStep("about")}>
        {passwordless ? (
          passwordFirst
        ) : (
          <TwoStepSection emailVerified={user.emailVerified} />
        )}
      </Section>
      <Section
        title={t("sessions.title")}
        description={t("sessions.description")}
      >
        {/* The server lists no session to staff acting as the member:
            each comes with its token. */}
        {me.value.impersonatedBy === null ? (
          <SessionsList />
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("sessions.impersonating")}
          </p>
        )}
      </Section>
      <Section title={t("apps.title")} description={t("apps.description")}>
        <ConnectedAppsList />
      </Section>
      {me.value.browserAnalytics === null ||
      me.value.browserAnalytics === undefined ? null : (
        <Section
          title={measurement("title")}
          description={measurement("description")}
        >
          <ConsentSetting />
        </Section>
      )}
      <Section
        title={t("export.title")}
        description={
          legalHold === null
            ? t("export.description")
            : `${t("export.description")} ${t("legalHold.exported")}`
        }
      >
        <ExportData />
      </Section>
      <Section title={t("delete.title")} description={t("delete.description")}>
        {passwordless ? (
          passwordFirst
        ) : (
          <DeleteAccount
            legalHold={<LegalHoldNotice legalHold={legalHold} />}
          />
        )}
      </Section>
    </div>
  );
};

export const generateMetadata = workspacePageTitle("account");

export default AccountPage;
