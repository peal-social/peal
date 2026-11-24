"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { Switch } from "peal-ui/components/switch";
import { toast } from "peal-ui/components/toast";
import { useId, useTransition } from "react";

import { useHydrated } from "#components/media/use-hydrated.ts";
import {
  setShortLinkDefault,
  shortLinkStatus,
  shortLinksChanged,
} from "#short-links/atoms.ts";

const LoadedDefault = ({
  mayChange,
  workspaceId,
}: {
  readonly mayChange: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ShortLinks.settings");
  const status = useAtomValue(shortLinkStatus(workspaceId));
  const update = useAtomSet(setShortLinkDefault, { mode: "promiseExit" });
  const [isPending, startTransition] = useTransition();
  const id = useId();

  if (AsyncResult.isFailure(status)) {
    return (
      <SettingsRow>
        <SettingsRowDescription>{t("loadFailed")}</SettingsRowDescription>
      </SettingsRow>
    );
  }

  if (!AsyncResult.isSuccess(status)) {
    return null;
  }

  if (!status.value.available) {
    return (
      <SettingsRow>
        <SettingsRowDescription>{t("unavailable")}</SettingsRowDescription>
      </SettingsRow>
    );
  }

  const change = (byDefault: boolean) => {
    startTransition(async () => {
      const exit = await update({
        headers: forWorkspace(workspaceId),
        payload: { byDefault },
        reactivityKeys: shortLinksChanged(workspaceId),
      });

      if (Exit.isSuccess(exit)) {
        toast.success(t("saved"));
      } else {
        toast.error(t("saveFailed"));
      }
    });
  };

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowLabel htmlFor={id}>{t("label")}</SettingsRowLabel>
        <SettingsRowDescription id={`${id}-hint`}>
          {mayChange ? t("hint") : t("readOnly")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <Switch
          id={id}
          checked={status.value.byDefault}
          disabled={!mayChange || isPending}
          aria-describedby={`${id}-hint`}
          onCheckedChange={change}
        />
      </SettingsRowControl>
    </SettingsRow>
  );
};

/**
 * Whether the workspace's new posts ask for short links by default, which
 * owners and admins set (`mayChange`, organization:update); on a server
 * without short links, it says so. The status is read with the visitor's
 * cookies, once the page has hydrated.
 */
export const ShortLinkDefaultForm = ({
  mayChange,
  workspaceId,
}: {
  readonly mayChange: boolean;
  readonly workspaceId: string;
}) =>
  useHydrated() ? (
    <LoadedDefault mayChange={mayChange} workspaceId={workspaceId} />
  ) : null;
