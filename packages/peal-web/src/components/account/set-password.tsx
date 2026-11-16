"use client";

import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { useCaptcha } from "#components/auth/turnstile-field.tsx";
import { getPathname } from "#i18n/navigation.ts";

/** What the action shows: a button, then where the link went. */
export const SetPasswordView = ({
  captcha,
  error,
  lead,
  onSend,
  pending,
  ready,
  sentTo,
}: {
  readonly captcha: ReactNode;
  readonly error: AuthErrorKey | null;
  /** What the section says first: why a password is needed here. */
  readonly lead: string;
  readonly onSend: () => void;
  readonly pending: boolean;
  readonly ready: boolean;
  readonly sentTo: string | null;
}) => {
  const t = useTranslations("AccountSettings.password");

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <p className="text-muted-foreground text-sm">{lead}</p>
      <FormError error={error} />
      {sentTo === null ? (
        <>
          {captcha}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={pending || !ready}
            focusableWhenDisabled
            onClick={onSend}
          >
            {pending ? t("setSending") : t("setSend")}
          </Button>
        </>
      ) : (
        <Alert>
          <AlertDescription>{t("setSent", { email: sentTo })}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// An account a sign-in provider made has no password: the reset link,
// sent to the account's own address, sets the first one. Better Auth
// answers the same whatever the address, and the email proves the inbox.
export const SetPassword = ({
  captchaSiteKey,
  email,
  lead,
}: {
  readonly captchaSiteKey: string | null;
  readonly email: string;
  readonly lead: string;
}) => {
  const locale = useLocale();
  const captcha = useCaptcha(captchaSiteKey);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const send = () => {
    startTransition(async () => {
      const result = await authClient.requestPasswordReset({
        email,
        fetchOptions: { headers: captcha.headers },
        redirectTo: getPathname({ href: "/reset-password", locale }),
      });

      // The token is spent, whatever the answer.
      captcha.reset();

      if (result.error === null) {
        setError(null);
        setSentTo(email);
      } else {
        setError(authErrorKey(result.error));
      }
    });
  };

  return (
    <SetPasswordView
      captcha={captcha.widget}
      error={error}
      lead={lead}
      onSend={send}
      pending={isPending}
      ready={captcha.ready}
      sentTo={sentTo}
    />
  );
};
