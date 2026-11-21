import { Effect, Option } from "effect";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { signUpSettings } from "#auth/captcha.ts";
import { providerErrorKey } from "#auth/errors.ts";
import { lastSignIn } from "#auth/last-sign-in-cookie.ts";
import { nextPathOf } from "#auth/next-path.ts";
import { cameFromProvider, signInReturn } from "#auth/provider-return.ts";
import { offersSignUp } from "#auth/sign-up-mode.ts";
import {
  dpaUrlConfig,
  privacyUrlConfig,
  termsUrlConfig,
} from "#billing/terms.ts";
import { AuthCard } from "#components/auth/auth-card.tsx";
import { FormError } from "#components/auth/form-error.tsx";
import { SignInChoices } from "#components/auth/sign-in-choices.tsx";
import { SignInForm } from "#components/auth/sign-in-form.tsx";
import { SignUpTerms } from "#components/auth/sign-up-terms.tsx";
import { getPathname, Link } from "#i18n/navigation.ts";

// The ways to sign in come first, the one this browser used last at
// their head (`lastSignIn`); email opens the form. ?next= names where to go once signed in, as the /device page asks. The
// link to sign up shows only where anyone may, which the server says at
// request time, as it says the providers to sign in with; there, a
// provider's sign-in makes the account an unknown address lacks, under the
// sign-up page's terms line, which shows here too. A provider's
// refusal comes back here as ?error=<code>, which only names a message,
// with ?from=provider; the authorization server's comes without it.
const SignInPage = async ({ searchParams }: PageProps<"/[locale]/login">) => {
  await connection();

  const { error, from, next } = await searchParams;

  const [{ mode, providers }, last, termsUrl, privacyUrl, dpaUrl] =
    await Promise.all([
      signUpSettings(),
      lastSignIn(),
      Effect.runPromise(termsUrlConfig),
      Effect.runPromise(privacyUrlConfig),
      Effect.runPromise(dpaUrlConfig),
    ]);

  const t = await getTranslations("SignInPage");
  const locale = await getLocale();
  const nextPath = Option.getOrElse(nextPathOf(next), () => "/");

  const signUpOffered = offersSignUp(mode);

  const refused = providerErrorKey(error, {
    fromProvider: cameFromProvider(from),
    providersOffered: providers.length > 0,
    signUpOffered,
  });

  return (
    <AuthCard
      title={t("title")}
      footer={
        signUpOffered ? (
          <p>
            {t("noAccount")}{" "}
            <Link href="/signup" className="text-foreground font-medium">
              {t("signUp")}
            </Link>
          </p>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <FormError error={Option.getOrNull(refused)} />
        <SignInChoices
          last={last}
          providers={providers}
          returnTo={signInReturn(
            nextPath,
            (href) => getPathname({ href, locale }),
            signUpOffered
          )}
        >
          <div className="flex flex-col gap-4">
            <SignInForm next={nextPath} />
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-center text-sm"
            >
              {t("forgotPassword")}
            </Link>
          </div>
        </SignInChoices>
        {signUpOffered && providers.length > 0 ? (
          <SignUpTerms
            message="providerTerms"
            termsUrl={termsUrl}
            privacyUrl={privacyUrl}
            dpaUrl={dpaUrl}
          />
        ) : null}
      </div>
    </AuthCard>
  );
};

export default SignInPage;
