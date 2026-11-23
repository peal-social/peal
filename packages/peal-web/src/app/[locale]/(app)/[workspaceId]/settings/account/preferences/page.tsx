import { Option } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { SettingsCard } from "peal-ui/components/settings";

import { currentUser } from "#auth/session.ts";
import { LanguageRow } from "#components/account/language-form.tsx";
import { TimeFormatRow } from "#components/account/time-format-form.tsx";
import { ConsentSetting } from "#components/measurement/consent-controls.tsx";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// How Peal reads for the signed-in person, in every workspace's settings:
// their language, how this browser writes times, and, where the web app
// measures, whether it may link what they do to them. Each applies as it
// is chosen.
const PreferencesPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/account/preferences">) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  const measured =
    me.value.browserAnalytics !== null &&
    me.value.browserAnalytics !== undefined;

  return (
    <SettingsGroup>
      <SettingsCard>
        <LanguageRow saved={me.value.user.locale} />
        <TimeFormatRow />
        {measured ? <ConsentSetting /> : null}
      </SettingsCard>
    </SettingsGroup>
  );
};

export const generateMetadata = workspacePageTitle("preferences");

export default PreferencesPage;
