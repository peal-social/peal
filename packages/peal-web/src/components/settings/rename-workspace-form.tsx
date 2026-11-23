"use client";

import { useTranslations } from "next-intl";
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
import { settingsErrorKey } from "#settings/errors.ts";

import { InlineTextSetting } from "./inline-text-setting.tsx";

// The workspace's name, typed in place and saved once the person leaves the
// field, through Better Auth's organization route, which checks
// organization:update. Without it, the name is shown and said who may
// change it.
export const WorkspaceNameRow = ({
  mayChange,
  name,
  workspaceId,
}: {
  readonly mayChange: boolean;
  readonly name: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("WorkspaceSettings.general");
  const errors = useTranslations("Settings.errors");
  const router = useRouter();

  const save = async (chosen: string) => {
    const result = await authClient.organization.update({
      data: { name: chosen },
      organizationId: workspaceId,
    });

    if (result.error !== null) {
      toast.error(errors(settingsErrorKey(result.error)));

      return false;
    }

    toast.success(t("renamed", { name: chosen }));
    router.refresh();

    return true;
  };

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel htmlFor={mayChange ? "workspace-name" : undefined}>
          {t("title")}
        </SettingsRowLabel>
        <SettingsRowDescription id="workspace-name-hint">
          {mayChange ? t("description") : t("readOnly")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        {mayChange ? (
          <InlineTextSetting
            id="workspace-name"
            autoComplete="organization"
            describedBy="workspace-name-hint"
            value={name}
            save={save}
          />
        ) : (
          <span className="text-sm">{name}</span>
        )}
      </SettingsRowControl>
    </SettingsRow>
  );
};
