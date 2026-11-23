"use client";

import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  SettingsCardBody,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { useId, useState } from "react";

import { PasswordForm } from "./password-form.tsx";

/**
 * The password's row: what it is, and **Change the password**, which opens
 * the form under it (DESIGN.md, "Settings": a form of several fields sits
 * in the card on its own) and closes it again.
 */
export const PasswordRow = () => {
  const t = useTranslations("AccountSettings.password");
  const settings = useTranslations("Settings");
  const formId = useId();
  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow>
        <SettingsRowText>
          <SettingsRowLabel>{t("title")}</SettingsRowLabel>
          <SettingsRowDescription>{t("description")}</SettingsRowDescription>
        </SettingsRowText>
        <SettingsRowControl>
          <Button
            variant="outline"
            aria-expanded={open}
            aria-controls={formId}
            onClick={() => {
              setOpen(!open);
            }}
          >
            {open ? settings("cancel") : t("change")}
          </Button>
        </SettingsRowControl>
      </SettingsRow>
      {open ? (
        <SettingsCardBody id={formId}>
          <PasswordForm />
        </SettingsCardBody>
      ) : null}
    </>
  );
};
