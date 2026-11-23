"use client";

import { Schema } from "effect";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { usePathname, useRouter } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { settingsErrorKey } from "#settings/errors.ts";

const isLocale = Schema.is(Schema.Literals(routing.locales));

/**
 * The language Peal writes to the person in: their emails, and the app,
 * which opens in it as soon as it is chosen, and whenever they sign in.
 */
export const LanguageRow = ({ saved }: { readonly saved: Locale }) => {
  const t = useTranslations("AccountSettings.language");
  const errors = useTranslations("Settings.errors");
  const shown = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const labelId = useId();
  const hintId = useId();
  const [chosen, setChosen] = useState<Locale>(saved);
  const [isPending, startTransition] = useTransition();

  const handleChosen = (value: string | null) => {
    if (value === null || !isLocale(value) || value === chosen) {
      return;
    }

    const before = chosen;

    setChosen(value);

    startTransition(async () => {
      const result = await authClient.updateUser({ locale: value });

      if (result.error !== null) {
        setChosen(before);
        toast.error(errors(settingsErrorKey(result.error)));

        return;
      }

      // The page itself is the confirmation, in the language chosen.
      if (value === shown) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        router.replace(pathname, { locale: value });
      }
    });
  };

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel id={labelId}>{t("label")}</SettingsRowLabel>
        <SettingsRowDescription id={hintId}>
          {t("description")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <Select
          value={chosen}
          disabled={isPending}
          onValueChange={handleChosen}
        >
          <SelectTrigger aria-labelledby={labelId} aria-describedby={hintId}>
            <SelectValue>
              <span lang={chosen}>{t("option", { locale: chosen })}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {routing.locales.map((locale) => (
              <SelectItem key={locale} value={locale} lang={locale}>
                {t("option", { locale })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRowControl>
    </SettingsRow>
  );
};
