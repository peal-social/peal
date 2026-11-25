"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "peal-ui/components/alert-dialog";
import { Button } from "peal-ui/components/button";
import {
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowText,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { signOutOtherSessions } from "#settings/revoke-others.ts";

// Signs out every session but this one, once confirmed: it cannot be
// taken back, and each of them must sign in again.
const RevokeOthers = ({ onChanged }: { readonly onChanged: () => void }) => {
  const t = useTranslations("AccountSettings.sessions");
  const settings = useTranslations("Settings");
  const errors = useTranslations("Settings.errors");
  const [isPending, startTransition] = useTransition();

  const handleRevoke = () => {
    startTransition(async () => {
      await signOutOtherSessions({
        refused: (reason) => {
          toast.error(errors(reason));
        },
        revoke: async () => await authClient.revokeOtherSessions(),
        signedOut: () => {
          toast.success(t("othersRevoked"));
          onChanged();
        },
      });
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            disabled={isPending}
            focusableWhenDisabled
          />
        }
      >
        {isPending ? t("revoking") : t("revokeOthers")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("revokeOthersTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("revokeOthersDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{settings("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleRevoke}>
            {t("revokeOthers")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

/**
 * The sessions card's row that signs out every other session: under the
 * list, and beside **Sign in again** for a session too old to read it,
 * which may still sign the others out (`#settings/revoke-others.ts`).
 * `onChanged` reads the list again once they are.
 */
export const RevokeOthersRow = ({
  onChanged,
}: {
  readonly onChanged: () => void;
}) => {
  const t = useTranslations("AccountSettings.sessions");

  return (
    <SettingsRow>
      <SettingsRowText>
        <SettingsRowDescription>
          {t("revokeOthersDescription")}
        </SettingsRowDescription>
      </SettingsRowText>
      <SettingsRowControl>
        <RevokeOthers onChanged={onChanged} />
      </SettingsRowControl>
    </SettingsRow>
  );
};
