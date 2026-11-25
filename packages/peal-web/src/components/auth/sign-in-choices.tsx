"use client";

import { Option } from "effect";
import { ArrowLeftIcon, KeyRound, MailIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { LastSignIn, SignInProvider } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";
import type { ReactElement, ReactNode } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { methodsOf } from "#auth/last-sign-in.ts";
import type { SignInMethod } from "#auth/last-sign-in.ts";
import type { ProviderReturn } from "#auth/provider-return.ts";
import { expectSignIn, forgetSignIn } from "#auth/sign-in-arrival.ts";
import { tabStorage } from "#auth/signed-out-notice.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { GoogleMark } from "#components/auth/google-mark.tsx";

const MethodIcon = ({ method }: { readonly method: SignInMethod }) => {
  if (method === "google") {
    return <GoogleMark />;
  }

  return method === "email" ? (
    <MailIcon aria-hidden />
  ) : (
    <KeyRound aria-hidden />
  );
};

// The first way is the page's main action, the ink button, Google's
// included; every other is an outline button (DESIGN.md, Icons).
const variantOf = (index: number) => (index === 0 ? "default" : "outline");

/**
 * The ways to sign in, as markup: one button each, the width of the
 * column, the one this browser used last first and the page's main
 * action, with a line saying so under it; without one, the first
 * provider's. "Continue with email" opens the form (`onEmail`).
 */
export const SignInChoicesView = ({
  error,
  last,
  onChoose,
  onEmail,
  pending,
  providers,
}: {
  /** Why starting the last sign-in failed, if it did. */
  readonly error: AuthErrorKey | null;
  readonly last: LastSignIn | null;
  readonly onChoose: (provider: SignInProvider["id"]) => void;
  readonly onEmail: () => void;
  readonly pending: boolean;
  readonly providers: readonly SignInProvider[];
}) => {
  const t = useTranslations("Auth.providers");
  const methods = methodsOf(providers, last);

  const nameOf = (method: SignInMethod) =>
    method === "email"
      ? t("emailMethod")
      : (providers.find(({ id }) => id === method)?.name ?? method);

  return (
    <div className="flex flex-col gap-4">
      <FormError error={error} />
      {methods.map((method, index) => (
        <div key={method} className="flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            variant={variantOf(index)}
            disabled={pending && method !== "email"}
            focusableWhenDisabled
            onClick={() => {
              if (method === "email") {
                onEmail();
              } else {
                onChoose(method);
              }
            }}
          >
            <MethodIcon method={method} />
            {method === "email"
              ? t("email")
              : t("continueWith", { name: nameOf(method) })}
          </Button>
          {index === 0 && method === last ? (
            <p className="text-muted-foreground text-center text-sm">
              {t("lastUsed", { method: nameOf(method) })}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

/**
 * Starts a provider's sign-in: Better Auth answers with the provider's
 * address, which its client opens. During an OAuth authorization the
 * client sends the page's signed query too, and the server resumes the
 * authorization once the provider's callback signed the person in.
 */
const useProviderSignIn = (returnTo: ProviderReturn) => {
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
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

      // On success, Better Auth's client is sending the browser on, to
      // the provider, which may yet refuse or be left: nobody is signed
      // in so far. The mark waits in the tab for the page the provider
      // brings the person back to, which tells the other tabs who signed
      // in (`TabPerson`); a refusal drops it.
      for (const storage of Option.toArray(tabStorage())) {
        if (result.error === null) {
          expectSignIn(storage);
        } else {
          forgetSignIn(storage);
        }
      }

      setError(result.error === null ? null : authErrorKey(result.error));
    });
  };

  return { choose, error, pending };
};

/**
 * The sign-in and sign-up pages' ways in: the providers the server offers
 * and email, whose form (`children`) shows once chosen, with a way back to
 * the choice. A server with no provider shows the form at once.
 */
export const SignInChoices = ({
  children,
  last,
  providers,
  returnTo,
}: {
  readonly children: ReactNode;
  readonly last: LastSignIn | null;
  readonly providers: readonly SignInProvider[];
  readonly returnTo: ProviderReturn;
}): ReactElement => {
  const t = useTranslations("Auth.providers");
  const [emailOpen, setEmailOpen] = useState(false);
  const { choose, error, pending } = useProviderSignIn(returnTo);

  if (providers.length === 0) {
    return <div className="flex flex-col">{children}</div>;
  }

  // Each step fades in as it takes the other's place (DESIGN.md,
  // `sign-in`); with reduced motion it appears at once.
  if (emailOpen) {
    return (
      <div
        key="email"
        className="animate-in fade-in flex flex-col gap-4 duration-300 ease-out motion-reduce:animate-none"
      >
        {children}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEmailOpen(false);
          }}
        >
          <ArrowLeftIcon aria-hidden />
          {t("back")}
        </Button>
      </div>
    );
  }

  return (
    <div
      key="choices"
      className="animate-in fade-in duration-300 ease-out motion-reduce:animate-none"
    >
      <SignInChoicesView
        error={error}
        last={last}
        pending={pending}
        providers={providers}
        onChoose={choose}
        onEmail={() => {
          setEmailOpen(true);
        }}
      />
    </div>
  );
};
