"use client";

import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";

import { useSignOut } from "#auth/use-sign-out.ts";

/**
 * Signs the person out, as the account menu does (`useSignOut`), after
 * which the browser loads the app anew without the session, which sends
 * them to sign in.
 */
export const SignOutButton = () => {
  const t = useTranslations("UserMenu");
  const [isPending, startTransition] = useTransition();
  const { leaving, signOut } = useSignOut();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut({
        refused: () => {
          toast.error(t("signOutFailed"));
        },
        to: "/",
      });
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      disabled={isPending || leaving}
      focusableWhenDisabled
    >
      {t("signOut")}
    </Button>
  );
};
