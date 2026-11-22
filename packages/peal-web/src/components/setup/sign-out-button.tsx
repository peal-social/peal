"use client";

import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { forgetConversation } from "peal-ui/lib/support/crisp";
import { useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { useMeasurementSignOut } from "#components/measurement/measurement.tsx";
import { useRouter } from "#i18n/navigation.ts";

/**
 * Signs the person out, as the account menu does, after which the page
 * renders again without the session and sends them to sign in.
 */
export const SignOutButton = () => {
  const t = useTranslations("UserMenu");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const forgetMeasurement = useMeasurementSignOut();

  const handleSignOut = () => {
    startTransition(async () => {
      const result = await authClient.signOut();

      if (result.error === null) {
        // Before leaving, so nothing more is measured as the person.
        forgetMeasurement();
        forgetConversation();
        router.push("/");
        router.refresh();
      } else {
        toast.error(t("signOutFailed"));
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={isPending}
      focusableWhenDisabled
    >
      {t("signOut")}
    </Button>
  );
};
