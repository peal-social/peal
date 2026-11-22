"use client";

import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "peal-ui/components/button";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { authClient } from "#auth/client.ts";
import { confirmationResultOf } from "#auth/email-confirmation.ts";
import type { ConfirmationResult } from "#auth/email-confirmation.ts";
import { AuthCard } from "#components/auth/auth-card.tsx";
import { ResendVerificationForm } from "#components/auth/resend-verification-form.tsx";
import { Link } from "#i18n/navigation.ts";

type State = ConfirmationResult | "idle" | "pending";

// Posts the emailed token, from this browser.
const post = async (token: string): Promise<ConfirmationResult> => {
  try {
    return confirmationResultOf(
      await authClient.$fetch("/confirm-email", {
        body: { token },
        method: "POST",
      })
    );
  } catch {
    return "failed";
  }
};

const card = (
  title: string,
  description: string,
  children: ReactNode
): ReactElement => (
  <AuthCard title={title} description={description}>
    {children}
  </AuthCard>
);

/**
 * Confirms the address the emailed token names: posts it once the page
 * runs, so a mail gateway that only opens the link confirms nothing, and
 * offers a button for a browser that did not post it. The token leaves
 * the address bar as soon as the page has read it.
 */
export const ConfirmEmail = ({
  token,
}: {
  readonly token: string;
}): ReactElement => {
  const t = useTranslations("VerifyEmailPage");
  const [state, setState] = useState<State>("idle");
  const posted = useRef(false);

  const confirm = useCallback(() => {
    setState("pending");
    void post(token).then(setState);
  }, [token]);

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);

    // Once, React's development double run included: a second post would
    // find the address confirmed.
    if (!posted.current) {
      posted.current = true;
      confirm();
    }
  }, [confirm]);

  if (state === "idle" || state === "pending" || state === "failed") {
    return card(
      t("confirmTitle"),
      state === "failed" ? t("failedDescription") : t("confirming"),
      <Button
        onClick={confirm}
        disabled={state === "pending"}
        focusableWhenDisabled
      >
        {t("confirm")}
      </Button>
    );
  }

  if (state === "signedIn") {
    return card(
      t("title"),
      t("description"),
      <Link href="/" className={buttonVariants()}>
        {t("continue")}
      </Link>
    );
  }

  if (state === "passwordNeeded") {
    return card(
      t("title"),
      t("passwordNeededDescription"),
      <Link href="/forgot-password" className={buttonVariants()}>
        {t("choosePassword")}
      </Link>
    );
  }

  if (state === "alreadyConfirmed") {
    return card(
      t("alreadyTitle"),
      t("alreadyDescription"),
      <div className="flex flex-col gap-2">
        <Link href="/login" className={buttonVariants()}>
          {t("signIn")}
        </Link>
        <Link
          href="/forgot-password"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("forgotPassword")}
        </Link>
      </div>
    );
  }

  if (state === "replaced") {
    return card(
      t("replacedTitle"),
      t("replacedDescription"),
      <Link href="/signup" className={buttonVariants()}>
        {t("signUp")}
      </Link>
    );
  }

  if (state === "inUse") {
    return card(t("inUseTitle"), t("inUseDescription"), null);
  }

  // A link that expired, or never worked.
  return card(
    t("invalidTitle"),
    t("invalidDescription"),
    <ResendVerificationForm />
  );
};
