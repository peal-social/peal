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
import { InlineTextSetting } from "#components/settings/inline-text-setting.tsx";
import { useRouter } from "#i18n/navigation.ts";
import { settingsErrorKey } from "#settings/errors.ts";

/**
 * The name other members see, and that invitations sign with: typed in
 * place, and saved once the person leaves the field.
 */
export const ProfileNameRow = ({ name }: { readonly name: string }) => {
  const t = useTranslations("AccountSettings.profile");
  const errors = useTranslations("Settings.errors");
  const router = useRouter();

  const save = async (chosen: string) => {
    const result = await authClient.updateUser({ name: chosen });

    if (result.error !== null) {
      toast.error(errors(settingsErrorKey(result.error)));

      return false;
    }

    toast.success(t("saved"));
    router.refresh();

    return true;
  };

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel htmlFor="account-name">{t("name")}</SettingsRowLabel>
        <SettingsRowDescription id="account-name-hint">
          {t("description")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <InlineTextSetting
          id="account-name"
          autoComplete="name"
          describedBy="account-name-hint"
          value={name}
          save={save}
        />
      </SettingsRowControl>
    </SettingsRow>
  );
};
