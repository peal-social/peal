"use client";

import { KeyRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { SignInProvider } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import type { ProviderReturn } from "#auth/provider-return.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { GoogleMark } from "#components/auth/google-mark.tsx";

/** The buttons, as markup: one per provider, then "or" before the form. */
export const ProviderButtonsView = ({
  error,
  onChoose,
  pending,
  providers,
}: {
  /** Why starting the last sign-in failed, if it did. */
  readonly error: AuthErrorKey | null;
  readonly onChoose: (provider: SignInProvider["id"]) => void;
  readonly pending: boolean;
  readonly providers: readonly SignInProvider[];
}) => {
  const t = useTranslations("Auth.providers");

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError error={error} />
      <div className="flex flex-col gap-2">
        {providers.map(({ id, name }) => (
          <Button
            key={id}
            type="button"
            variant="outline"
            disabled={pending}
            focusableWhenDisabled
            onClick={() => {
              onChoose(id);
            }}
          >
            {id === "google" ? <GoogleMark /> : <KeyRound aria-hidden />}
            {t("continueWith", { name })}
          </Button>
        ))}
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        {t("or")}
        <span className="bg-border h-px flex-1" />
      </div>
    </div>
  );
};

// Starts a provider's sign-in: Better Auth answers with the provider's
// address, which its client opens. During an OAuth authorization the client
// sends the page's signed query too, and the server resumes the
// authorization once the provider's callback signed the person in.
export const ProviderButtons = ({
  providers,
  returnTo,
}: {
  readonly providers: readonly SignInProvider[];
  readonly returnTo: ProviderReturn;
}) => {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<AuthErrorKey | null>(null);

  const choose = (provider: SignInProvider["id"]) => {
    startTransition(async () => {
      const { signUp } = returnTo;

      const result = await authClient.signIn.social(
        signUp === undefined
          ? {
              callbackURL: returnTo.next,
              errorCallbackURL: returnTo.errorPath,
              provider,
            }
          : {
              additionalData:
                signUp.invitationId === null
                  ? { locale }
                  : { invitation: signUp.invitationId, locale },
              callbackURL: returnTo.next,
              errorCallbackURL: returnTo.errorPath,
              newUserCallbackURL: signUp.newUserPath,
              provider,
              requestSignUp: true,
            }
      );

      // On success, Better Auth's client is sending the browser on.
      setError(result.error === null ? null : authErrorKey(result.error));
    });
  };

  return (
    <ProviderButtonsView
      error={error}
      onChoose={choose}
      pending={isPending}
      providers={providers}
    />
  );
};
