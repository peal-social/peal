"use client";

import { Option } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { signUpInvitationHeader } from "peal-contract";
import { Alert, AlertDescription, AlertTitle } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { signUpLanding } from "#auth/provider-return.ts";
import { tellOtherTabs } from "#auth/session-news.ts";
import { signedInAtSignUp } from "#auth/sign-up-answer.ts";
import { loadAnew } from "#auth/use-load-anew.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { FormField } from "#components/auth/form-field.tsx";
import { useCaptcha } from "#components/auth/turnstile-field.tsx";
import { getPathname } from "#i18n/navigation.ts";
import { tellTabs } from "#measurement/tabs.ts";

// Creates the account, in the page's language, which its emails will use.
// The confirmation link signs the new user in on the verify-email page; a
// server that asks for no confirmation signs them in at once, and the
// form loads the app anew.
// With a Turnstile site key, the server wants the widget's token too; from
// an invitation's page, the invitation's id goes with it. Creating the
// account accepts the terms, which the page says under it (`SignUpTerms`).
export const SignUpForm = ({
  captchaSiteKey,
  invitationId,
}: {
  readonly captchaSiteKey: string | null;
  /**
   * The invitation the visitor came from, which a server where accounts are
   * made by invitation needs with the address it went to.
   */
  readonly invitationId: string | null;
}) => {
  const t = useTranslations("SignUpPage");
  const fields = useTranslations("Auth");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // From a sign-up that signed in until the next page replaces this one.
  const [leaving, setLeaving] = useState(false);
  const busy = isPending || leaving;
  const captcha = useCaptcha(captchaSiteKey);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const headers = new Headers(captcha.headers);

    if (invitationId !== null) {
      headers.set(signUpInvitationHeader, invitationId);
    }

    startTransition(async () => {
      const result = await authClient.signUp.email({
        callbackURL: getPathname({ href: "/verify-email", locale }),
        email,
        fetchOptions: { headers },
        locale,
        name,
        password,
      });

      // The token is spent, whatever the answer.
      captcha.reset();

      if (result.error !== null) {
        setError(authErrorKey(result.error));

        return;
      }

      setError(null);

      // A server that asks for no confirmation signed the browser in:
      // like every sign-in, the next page loads anew and the browser's
      // other tabs are told who.
      Option.match(signedInAtSignUp(result.data), {
        onNone: () => {
          setSentTo(email);
        },
        onSome: (userId) => {
          tellTabs({ kind: "signedIn" });
          tellOtherTabs({ kind: "signedIn", userId });
          setLeaving(true);
          loadAnew(getPathname({ href: signUpLanding(invitationId), locale }));
        },
      });
    });
  };

  if (sentTo !== null) {
    return (
      <Alert>
        <AlertTitle>{t("checkInbox")}</AlertTitle>
        <AlertDescription>{t("sent", { email: sentTo })}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError error={error} />
      <FormField
        id="name"
        type="text"
        autoComplete="name"
        label={fields("name")}
        value={name}
        onChange={setName}
      />
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
        autoComplete="new-password"
        label={fields("password")}
        hint={fields("passwordHint")}
        minLength={12}
        value={password}
        onChange={setPassword}
      />
      {captcha.widget}
      <Button
        type="submit"
        disabled={busy || !captcha.ready}
        focusableWhenDisabled
      >
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
};
