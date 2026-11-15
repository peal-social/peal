import { Option } from "effect";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { signUpSettings } from "#auth/captcha.ts";
import { providerErrorKey } from "#auth/errors.ts";
import { nextPathOf } from "#auth/next-path.ts";
import { offersSignUp } from "#auth/sign-up-mode.ts";
import { AuthCard } from "#components/auth/auth-card.tsx";
import { FormError } from "#components/auth/form-error.tsx";
import { ProviderButtons } from "#components/auth/provider-buttons.tsx";
import { SignInForm } from "#components/auth/sign-in-form.tsx";
import { getPathname, Link } from "#i18n/navigation.ts";

// ?next= names where to go once signed in, as the /device page asks. The
// link to sign up shows only where anyone may, which the server says at
// request time, as it says the providers to sign in with. A provider's
// refusal comes back here as ?error=<code>, which only names a message.
const SignInPage = async ({ searchParams }: PageProps<"/[locale]/sign-in">) => {
  await connection();

  const { error, next } = await searchParams;
  const { mode, providers } = await signUpSettings();
  const t = await getTranslations("SignInPage");
  const locale = await getLocale();
  const nextPath = Option.getOrElse(nextPathOf(next), () => "/app");
  const refused = providerErrorKey(error, offersSignUp(mode));

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <>
          <Link href="/forgot-password" className="text-foreground underline">
            {t("forgotPassword")}
          </Link>
          {offersSignUp(mode) ? (
            <p>
              {t("noAccount")}{" "}
              <Link href="/sign-up" className="text-foreground underline">
                {t("signUp")}
              </Link>
            </p>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError error={Option.getOrNull(refused)} />
        <ProviderButtons
          providers={providers}
          returnTo={{
            errorPath: getPathname({
              href: { pathname: "/sign-in", query: { next: nextPath } },
              locale,
            }),
            // As the password's sign-in opens it: the language follows.
            next: nextPath,
          }}
        />
        <SignInForm next={nextPath} />
      </div>
    </AuthCard>
  );
};

export default SignInPage;
