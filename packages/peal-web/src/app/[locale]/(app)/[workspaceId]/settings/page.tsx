import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";

import { ApprovalPolicyForm } from "#components/settings/approval-policy-form.tsx";
import { DeleteWorkspace } from "#components/settings/delete-workspace.tsx";
import { WorkspaceNameRow } from "#components/settings/rename-workspace-form.tsx";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import { ShortLinkDefaultForm } from "#components/settings/short-link-default-form.tsx";
import { WorkspaceAddressRow } from "#components/settings/workspace-address-form.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

// The workspace itself: its name and address, which posts wait for an
// approval, whether new posts shorten their links, and, last, deleting
// it, for those whose role allows each.
const WorkspacePage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const t = await getTranslations("WorkspaceSettings");
  const review = await getTranslations("Review");
  const shortLinks = await getTranslations("ShortLinks.settings");
  const settings = await getTranslations("Settings");
  const may = new Set(workspace.permissions);
  const mayUpdate = may.has("organization:update");

  return (
    <>
      <SettingsGroup>
        <SettingsCard>
          <WorkspaceNameRow
            mayChange={mayUpdate}
            name={workspace.name}
            workspaceId={workspace.id}
          />
          {mayUpdate ? (
            <WorkspaceAddressRow
              slug={workspace.slug}
              workspaceId={workspace.id}
            />
          ) : null}
        </SettingsCard>
      </SettingsGroup>
      <SettingsGroup
        title={review("policy.title")}
        description={review("policy.description")}
      >
        <SettingsCard>
          {mayUpdate ? (
            <SettingsCardBody>
              <ApprovalPolicyForm workspaceId={workspace.id} />
            </SettingsCardBody>
          ) : (
            <SettingsRow>
              <SettingsRowDescription>
                {review("policy.readOnly")}
              </SettingsRowDescription>
            </SettingsRow>
          )}
        </SettingsCard>
      </SettingsGroup>
      {may.has("post:read") ? (
        <SettingsGroup
          title={shortLinks("title")}
          description={shortLinks("description")}
        >
          <SettingsCard>
            <ShortLinkDefaultForm
              mayChange={mayUpdate}
              workspaceId={workspace.id}
            />
          </SettingsCard>
        </SettingsGroup>
      ) : null}
      {may.has("organization:delete") ? (
        <SettingsGroup title={settings("dangerZone")}>
          <SettingsCard>
            <SettingsRow>
              <SettingsRowText>
                <SettingsRowLabel>{t("delete.title")}</SettingsRowLabel>
                <SettingsRowDescription>
                  {t("delete.description")}
                </SettingsRowDescription>
              </SettingsRowText>
              <SettingsRowControl>
                <DeleteWorkspace
                  name={workspace.name}
                  workspaceId={workspace.id}
                />
              </SettingsRowControl>
            </SettingsRow>
          </SettingsCard>
        </SettingsGroup>
      ) : null}
    </>
  );
};

export const generateMetadata = workspacePageTitle("general");

export default WorkspacePage;
