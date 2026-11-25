"use client";

import { Option, Schema } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { landingAddress } from "#auth/next-path.ts";
import { isOAuthRedirect } from "#auth/oauth-redirect.ts";
import { tellOtherTabs } from "#auth/session-news.ts";
import { loadAnew } from "#auth/use-load-anew.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { FormField } from "#components/auth/form-field.tsx";
import {
  recoveryCodeOf,
  TwoStepChallengeView,
} from "#components/auth/two-step-challenge-view.tsx";
import type { ChallengeMode } from "#components/auth/two-step-challenge-view.tsx";
import { getPathname } from "#i18n/navigation.ts";
import { tellTabs } from "#measurement/tabs.ts";

// What a sign-in answers an account with two-step verification on: no
// session yet, and the second step to take.
const isChallenge = Schema.is(
  Schema.Struct({ twoFactorRedirect: Schema.Literal(true) })
);

// What a sign-in, or its second step, answers once it is done: the
// language the account keeps, if any.
interface SignedInAnswer {
  readonly user: { readonly locale?: string | null | undefined };
}

const localeOf = ({ user }: SignedInAnswer): Option.Option<string> =>
  Option.fromNullishOr(user.locale);

// Signed in: the other tabs of Peal measure nobody's session until they
// read who is signed in now, and load the app anew.
const tellTabsSignedIn = () => {
  tellTabs({ kind: "signedIn" });
  tellOtherTabs({ kind: "signedIn" });
};

// `next` is where to go once signed in. During an OAuth authorization, Better
// Auth answers the sign-in with the next step instead, which its client
// follows, the second step's included.
export const SignInForm = ({ next }: { readonly next: string }) => {
  const t = useTranslations("SignInPage");
  const fields = useTranslations("Auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [resentTo, setResentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [challenged, setChallenged] = useState(false);
  const [mode, setMode] = useState<ChallengeMode>("app");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  // From a sign-in that worked until the next page replaces this one.
  const [leaving, setLeaving] = useState(false);

  // Once signed in: on to `next`, in the language the account keeps, which
  // may not be this page's, loaded anew rather than in place. A session
  // that ended elsewhere (expired, revoked) brought the tab here in place,
  // with what it held for the last person: the new one starts afresh.
  const goNext = (accountLocale: Option.Option<string>) => {
    tellTabsSignedIn();
    setLeaving(true);
    loadAnew(
      landingAddress(
        next,
        Option.getOrUndefined(accountLocale),
        locale,
        (href, landing) => getPathname({ href, locale: landing })
      )
    );
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await authClient.signIn.email({ email, password });

      if (result.error !== null) {
        setResentTo(null);
        setError(authErrorKey(result.error));

        return;
      }

      if (isChallenge(result.data)) {
        setError(null);
        setChallenged(true);

        return;
      }

      // During an OAuth authorization, Better Auth's client follows the
      // redirect it answered with instead, loading the next page anew.
      if (isOAuthRedirect(result.data)) {
        tellTabsSignedIn();

        return;
      }

      goNext(localeOf(result.data));
    });
  };

  const handleVerify = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result =
        mode === "app"
          ? await authClient.twoFactor.verifyTotp({
              code: code.trim(),
              trustDevice: trust,
            })
          : await authClient.twoFactor.verifyBackupCode({
              code: recoveryCodeOf(code),
              trustDevice: trust,
            });

      if (result.error !== null) {
        setError(authErrorKey(result.error));
        setCode("");

        return;
      }

      if (isOAuthRedirect(result.data)) {
        tellTabsSignedIn();
      } else {
        goNext(localeOf(result.data));
      }
    });
  };

  const handleMode = (chosen: ChallengeMode) => {
    setMode(chosen);
    setCode("");
    setError(null);
  };

  // A spent second step: back to the password.
  const handleStartAgain = () => {
    setChallenged(false);
    setMode("app");
    setCode("");
    setError(null);
  };

  if (challenged) {
    return (
      <TwoStepChallengeView
        code={code}
        error={error}
        mode={mode}
        pending={isPending || leaving}
        trust={trust}
        onCode={setCode}
        onMode={handleMode}
        onStartAgain={handleStartAgain}
        onSubmit={handleVerify}
        onTrust={setTrust}
      />
    );
  }

  // Someone who lost the confirmation email asks for another.
  const handleResend = () => {
    startTransition(async () => {
      const result = await authClient.sendVerificationEmail({
        callbackURL: getPathname({ href: "/verify-email", locale }),
        email,
      });

      if (result.error === null) {
        setError(null);
        setResentTo(email);
      } else {
        setError(authErrorKey(result.error));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError error={error} />
      {resentTo === null ? null : (
        <Alert>
          <AlertDescription>
            {t("resent", { email: resentTo })}
          </AlertDescription>
        </Alert>
      )}
      <FormField
        id="email"
        type="email"
        autoComplete="email"
        label={fields("email")}
        value={email}
        onChange={setEmail}
      />
      <FormField
        id="password"
        type="password"
        autoComplete="current-password"
        label={fields("password")}
        value={password}
        onChange={setPassword}
      />
      <Button
        type="submit"
        disabled={isPending || leaving}
        focusableWhenDisabled
      >
        {isPending || leaving ? t("submitting") : t("submit")}
      </Button>
      {error === "EMAIL_NOT_VERIFIED" ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          focusableWhenDisabled
          onClick={handleResend}
        >
          {t("resend")}
        </Button>
      ) : null}
    </form>
  );
};
