import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";

// The right of access: a JSON file of everything Peal keeps about the user,
// which the server answers as a download, with the visitor's session.
export const ExportDataRow = ({
  description,
}: {
  readonly description: string;
}) => {
  const t = useTranslations("AccountSettings.export");

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel>{t("label")}</SettingsRowLabel>
        <SettingsRowDescription>{description}</SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <Button
          variant="outline"
          render={
            <a href="/api/me/export" download>
              {t("download")}
            </a>
          }
        />
      </SettingsRowControl>
    </SettingsRow>
  );
};
