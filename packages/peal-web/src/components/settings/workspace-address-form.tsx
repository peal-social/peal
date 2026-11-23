"use client";

import { useTranslations } from "next-intl";
import { isWorkspaceSlug } from "peal-contract/workspace-slug";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";

import { authClient } from "#auth/client.ts";
import { useRouter } from "#i18n/navigation.ts";
import { useMounted } from "#posts/use-mounted.ts";
import { settingsErrorKey } from "#settings/errors.ts";
import { workspacePath } from "#shell/workspace-path.ts";

import { InlineTextSetting } from "./inline-text-setting.tsx";

// The workspace's slug, the address its pages go by, after the site's
// address as the setup page writes it: typed in place and saved once the
// person leaves the field, through Better Auth's organization route, which
// checks organization:update and that no other workspace holds it; the
// server's hook checks the web app can route it. Once changed, the page
// opens under the new address.
export const WorkspaceAddressRow = ({
  slug,
  workspaceId,
}: {
  readonly slug: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("WorkspaceSettings.address");
  const errors = useTranslations("Settings.errors");
  const router = useRouter();
  const host = useMounted() ? globalThis.location.host : "";

  const save = async (chosen: string) => {
    const result = await authClient.organization.update({
      data: { slug: chosen },
      organizationId: workspaceId,
    });

    if (result.error !== null) {
      toast.error(errors(settingsErrorKey(result.error)));

      return false;
    }

    toast.success(t("changed", { slug: chosen }));
    router.replace(workspacePath(chosen, "/settings"));
    router.refresh();

    return true;
  };

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel htmlFor="workspace-address">
          {t("label")}
        </SettingsRowLabel>
        <SettingsRowDescription id="workspace-address-hint">
          {t("description")} {t("hint")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <InlineTextSetting
          id="workspace-address"
          autoComplete="off"
          describedBy="workspace-address-hint"
          prefix={`${host}/`}
          check={isWorkspaceSlug}
          value={slug}
          save={save}
        />
      </SettingsRowControl>
    </SettingsRow>
  );
};
