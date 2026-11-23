import { Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionHeader,
} from "peal-ui/components/settings";

import { RecyclingSettings } from "#components/recycling/recycling-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

const decodeRule = Schema.decodeUnknownOption(Schema.String);

// A workspace's recycling rules, for members who may read its posts.
// Pausing, resuming or stopping one takes post:schedule; `rule` marks the
// one a notice opened the page for.
const RecyclingPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/settings/recycling">) => {
  const { locale, workspaceId } = await params;
  const { rule } = await searchParams;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!may.has("post:read")) {
    notFound();
  }

  const t = await getTranslations("Recycling");
  const mayChange = may.has("post:schedule");

  return (
    // The frame's header names the page: the list's heading only says what
    // a rule does, and to those who may only read, why they cannot change it.
    <SettingsSection>
      <SettingsSectionHeader>
        <SettingsSectionDescription>
          {mayChange
            ? t("description")
            : `${t("description")} ${t("readOnly")}`}
        </SettingsSectionDescription>
      </SettingsSectionHeader>
      <RecyclingSettings
        workspaceId={workspace.id}
        mayChange={mayChange}
        highlighted={Option.getOrNull(decodeRule(rule))}
      />
    </SettingsSection>
  );
};

export const generateMetadata = workspacePageTitle("recycling");

export default RecyclingPage;
