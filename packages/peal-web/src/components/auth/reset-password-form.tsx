"use client";

import { Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { FormField } from "#components/auth/form-field.tsx";
import { Link } from "#i18n/navigation.ts";

// What the server answers a reset that removed the API keys someone made
// in an account they used before its address was confirmed.
const decodeRemoved = Schema.decodeUnknownOption(
  Schema.Struct({ apiKeysRemoved: Schema.Number })
);

// Sets the new password with the token the emailed link carried.
export const ResetPasswordForm = ({ token }: { readonly token: string }) => {
  const t = useTranslations("ResetPasswordPage");
  const fields = useTranslations("Auth");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const [keysRemoved, setKeysRemoved] = useState(0);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmation) {
      setMismatch(true);

      return;
    }

    setMismatch(false);

    startTransition(async () => {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error === null) {
        setError(null);
        setKeysRemoved(
          Option.match(decodeRemoved(result.data), {
            onNone: () => 0,
            onSome: ({ apiKeysRemoved }) => apiKeysRemoved,
          })
        );
        setDone(true);
      } else {
        setError(authErrorKey(result.error));
      }
    });
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          <AlertDescription>{t("done")}</AlertDescription>
        </Alert>
        {keysRemoved > 0 ? (
          <Alert>
            <AlertDescription>
              {t("keysRemoved", { count: keysRemoved })}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button render={<Link href="/login" />}>{t("signIn")}</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError error={error} />
      {mismatch ? (
        <Alert variant="destructive">
          <AlertDescription>{t("mismatch")}</AlertDescription>
        </Alert>
      ) : null}
      <FormField
        id="new-password"
        type="password"
        autoComplete="new-password"
        label={fields("newPassword")}
        hint={fields("passwordHint")}
        minLength={12}
        value={password}
        onChange={setPassword}
      />
      <FormField
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        label={fields("confirmPassword")}
        minLength={12}
        value={confirmation}
        onChange={setConfirmation}
      />
      <Button type="submit" disabled={isPending} focusableWhenDisabled>
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
};
