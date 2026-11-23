"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import type {
  NotificationPreferences,
  NotificationPreferencesChange,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  SettingsCard,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
  SettingsSection,
  SettingsSectionDescription,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "peal-ui/components/settings";
import { Skeleton } from "peal-ui/components/skeleton";
import { Switch } from "peal-ui/components/switch";
import { toast } from "peal-ui/components/toast";
import { useId, useTransition } from "react";

import { useHydrated } from "#components/media/use-hydrated.ts";
import {
  changeNotificationPreferences,
  notificationPreferences,
  preferencesKeys,
} from "#notices/atoms.ts";

type EmailKind = Exclude<
  keyof NotificationPreferences["email"],
  "weeklyDigest"
>;

// Most pressing first: what needs the reader, then what went as planned;
// the weekly digest after them.
const kinds: readonly EmailKind[] = [
  "postFailed",
  "postUnconfirmed",
  "postReview",
  "recyclingEnded",
  "feedStopped",
  "automations",
  "channelReconnect",
  "comments",
  "webhookFailing",
  "postPublished",
];

// One kind of notice: what it is at the row's start, its switch at the end,
// saved as soon as it changes.
const PreferenceRow = ({
  checked,
  disabled,
  hint,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly hint?: string;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) => {
  const id = useId();
  const hintId = useId();

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel htmlFor={id}>{label}</SettingsRowLabel>
        {hint === undefined ? null : (
          <SettingsRowDescription id={hintId}>{hint}</SettingsRowDescription>
        )}
      </SettingsRowText>
      <SettingsRowControl>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          {...(hint === undefined ? {} : { "aria-describedby": hintId })}
          onCheckedChange={(next) => {
            onChange(next);
          }}
        />
      </SettingsRowControl>
    </SettingsRow>
  );
};

/**
 * The email choices, one switch per kind of notice, then whether the person
 * hears about every post or only theirs. Each change is saved at once,
 * alone, so two changed in quick succession both stay.
 */
export const PreferencesFields = ({
  onChange,
  preferences,
  saving,
}: {
  readonly onChange: (change: NotificationPreferencesChange) => void;
  readonly preferences: NotificationPreferences;
  readonly saving: boolean;
}) => {
  const t = useTranslations("Notices.preferences");

  return (
    <div className="flex flex-col gap-8" aria-busy={saving}>
      <SettingsSection aria-labelledby="email-preferences">
        <SettingsSectionHeader>
          <div>
            <SettingsSectionTitle id="email-preferences">
              {t("legend")}
            </SettingsSectionTitle>
            <SettingsSectionDescription>
              {t("description")}
            </SettingsSectionDescription>
          </div>
        </SettingsSectionHeader>
        <SettingsCard>
          {kinds.map((kind) => (
            <PreferenceRow
              key={kind}
              label={t(kind)}
              checked={preferences.email[kind]}
              disabled={saving}
              onChange={(checked) => {
                onChange({ email: { [kind]: checked } });
              }}
            />
          ))}
          <PreferenceRow
            label={t("weeklyDigest")}
            hint={t("weeklyDigestHint")}
            checked={preferences.email.weeklyDigest}
            disabled={saving}
            onChange={(checked) => {
              onChange({ email: { weeklyDigest: checked } });
            }}
          />
        </SettingsCard>
      </SettingsSection>
      <SettingsSection aria-labelledby="post-preferences">
        <SettingsSectionHeader>
          <SettingsSectionTitle id="post-preferences">
            {t("postsLegend")}
          </SettingsSectionTitle>
        </SettingsSectionHeader>
        <SettingsCard>
          <PreferenceRow
            label={t("everyPost")}
            hint={t("everyPostHint")}
            checked={preferences.everyPost}
            disabled={saving}
            onChange={(checked) => {
              onChange({ everyPost: checked });
            }}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  );
};

const LoadedPreferences = () => {
  const t = useTranslations("Notices.preferences");
  const result = useAtomValue(notificationPreferences);
  const reload = useAtomRefresh(notificationPreferences);

  const change = useAtomSet(changeNotificationPreferences, {
    mode: "promiseExit",
  });

  const [saving, startSaving] = useTransition();

  const handleChange = (payload: NotificationPreferencesChange) => {
    startSaving(async () => {
      const exit = await change({
        payload,
        reactivityKeys: preferencesKeys,
      });

      if (Exit.isSuccess(exit)) {
        toast.success(t("saved"));
      } else {
        toast.error(t("saveFailed"));
      }
    });
  };

  return AsyncResult.match(result, {
    onFailure: () => (
      <Alert variant="destructive">
        <AlertDescription>
          <span className="flex flex-wrap items-center justify-between gap-2">
            {t("loadFailed")}
            <Button variant="outline" size="sm" onClick={reload}>
              {t("reload")}
            </Button>
          </span>
        </AlertDescription>
      </Alert>
    ),
    onInitial: () => (
      <div aria-busy className="flex flex-col gap-3">
        <span className="sr-only">{t("loading")}</span>
        <Skeleton className="h-28" />
      </div>
    ),
    onSuccess: ({ value }) => (
      <PreferencesFields
        preferences={value}
        saving={saving}
        onChange={handleChange}
      />
    ),
  });
};

/** The user's email preferences, read and saved with their cookies. */
export const NotificationPreferencesForm = () => {
  const t = useTranslations("Notices.preferences");
  const hydrated = useHydrated();

  return hydrated ? (
    <LoadedPreferences />
  ) : (
    <div aria-busy>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-28" />
    </div>
  );
};
