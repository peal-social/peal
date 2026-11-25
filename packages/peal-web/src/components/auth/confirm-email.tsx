"use client";

import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "peal-ui/components/button";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { authClient } from "#auth/client.ts";
import { confirmationResultOf } from "#auth/email-confirmation.ts";
import type {
  ConfirmationIntent,
  ConfirmationResult,
} from "#auth/email-confirmation.ts";
import { tellOtherTabs } from "#auth/session-news.ts";
import { AuthCard } from "#components/auth/auth-card.tsx";
import { ResendVerificationForm } from "#components/auth/resend-verification-form.tsx";
import { Link } from "#i18n/navigation.ts";

// What the page shows: the server's answer, a post on its way, or the
// step that asks before an account is deleted (`eraseAsked`).
type State = ConfirmationResult | "eraseAsked" | "idle" | "pending";

// Posts the emailed token, from this browser, with why.
const confirmed = async (
  token: string,
  intent: ConfirmationIntent
): Promise<ConfirmationResult> => {
  try {
    return confirmationResultOf(
      await authClient.$fetch("/confirm-email", {
        body: { intent, token },
        method: "POST",
      })
    );
  } catch {
    return "failed";
  }
};

// Posts the token. Signed in from the email's link, on a page loaded
// anew: the other tabs of the app load anew too, as the person in them
// changed.
const post = async (
  token: string,
  intent: ConfirmationIntent
): Promise<ConfirmationResult> => {
  const result = await confirmed(token, intent);

  if (result === "signedIn") {
    tellOtherTabs({ kind: "signedIn" });
  }

  return result;
};

const card = (
  title: string,
  description: string,
  children: ReactNode
): ReactElement => (
  <AuthCard title={title} description={description}>
    <div className="flex flex-col gap-2">{children}</div>
  </AuthCard>
);

/**
 * Confirms the address the emailed token names. As it opens, the page
 * posts the token on its own (`auto`), which confirms only from the
 * browser that made the account, so a mail gateway that opens the link,
 * or another browser, changes nothing. Anywhere else, the page says what
 * confirming here does and asks (`confirm`); deleting an account someone
 * else made and used takes its own button and a second step (`erase`).
 * The token leaves the address bar as soon as the page has read it.
 */
export const ConfirmEmail = ({
  token,
}: {
  readonly token: string;
}): ReactElement => {
  const t = useTranslations("VerifyEmailPage");
  const [state, setState] = useState<State>("idle");
  const posted = useRef(false);

  const send = useCallback(
    (intent: ConfirmationIntent) => {
      setState("pending");
      void post(token, intent).then(setState);
    },
    [token]
  );

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);

    // Once, React's development double run included.
    if (!posted.current) {
      posted.current = true;
      send("auto");
    }
  }, [send]);

  const signIn = (
    <Link href="/login" className={buttonVariants({ variant: "outline" })}>
      {t("signIn")}
    </Link>
  );

  if (state === "idle" || state === "pending" || state === "failed") {
    return card(
      t("confirmTitle"),
      state === "failed" ? t("failedDescription") : t("confirming"),
      <Button
        onClick={() => {
          send("auto");
        }}
        disabled={state === "pending"}
        focusableWhenDisabled
      >
        {t("tryAgain")}
      </Button>
    );
  }

  if (state === "choose") {
    return card(
      t("confirmTitle"),
      t("chooseDescription"),
      <>
        <Button
          onClick={() => {
            send("confirm");
          }}
        >
          {t("confirm")}
        </Button>
        {signIn}
      </>
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
      <>
        <Link href="/login" className={buttonVariants()}>
          {t("signIn")}
        </Link>
        <Link
          href="/forgot-password"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("forgotPassword")}
        </Link>
      </>
    );
  }

  if (state === "inUse") {
    return card(
      t("inUseTitle"),
      t("inUseDescription"),
      <>
        <Link href="/login" className={buttonVariants()}>
          {t("signIn")}
        </Link>
        <Button
          variant="outline"
          onClick={() => {
            setState("eraseAsked");
          }}
        >
          {t("notMine")}
        </Button>
      </>
    );
  }

  if (state === "eraseAsked") {
    return card(
      t("eraseTitle"),
      t("eraseDescription"),
      <>
        <Button
          variant="destructive"
          onClick={() => {
            send("erase");
          }}
        >
          {t("erase")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setState("inUse");
          }}
        >
          {t("cancel")}
        </Button>
      </>
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

  if (state === "notErased") {
    return card(t("notErasedTitle"), t("notErasedDescription"), signIn);
  }

  // A link that expired, or never worked.
  return card(
    t("invalidTitle"),
    t("invalidDescription"),
    <ResendVerificationForm />
  );
};
