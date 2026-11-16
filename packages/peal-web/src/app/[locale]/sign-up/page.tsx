import { Effect, Option } from "effect";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";

import { signUpSettings } from "#auth/captcha.ts";
import { providerErrorKey } from "#auth/errors.ts";
import { cameFromProvider, signUpReturn } from "#auth/provider-return.ts";
import { invitationOf, signUpFormShown } from "#auth/sign-up-mode.ts";
import { privacyUrlConfig, termsUrlConfig } from "#billing/terms.ts";
import { AuthCard } from "#components/auth/auth-card.tsx";
import { FormError } from "#components/auth/form-error.tsx";
import { ProviderButtons } from "#components/auth/provider-buttons.tsx";
import { SignUpByInvitation } from "#components/auth/sign-up-by-invitation.tsx";
import { SignUpForm } from "#components/auth/sign-up-form.tsx";
import { getPathname, Link } from "#i18n/navigation.ts";

// Read at request time: whether the server wants a captcha, who may sign
// up, and where its terms and privacy policy are, are its settings, not the
// build's. On a server where accounts are made by invitation, the form
// shows to a visitor an invitation's page sent here (?invitation=<id>),
// which the sign-up sends: the server admits the address that invitation
// went to. The providers to sign up with show where the form shows, above
// it, and their sign-up carries the invitation too; the terms line under
// the form covers both ways. A provider's refusal comes back here as
// ?error=<code>, which only names a message, with ?from=provider.
const SignUpPage = async ({ searchParams }: PageProps<"/[locale]/sign-up">) => {
  await connection();

  const { error, from, invitation } = await searchParams;
  const t = await getTranslations("SignUpPage");
  const locale = await getLocale();
  const invitationId = invitationOf(invitation);

  const [{ mode, providers, siteKey }, termsUrl, privacyUrl] =
    await Promise.all([
      signUpSettings(),
      Effect.runPromise(termsUrlConfig),
      Effect.runPromise(privacyUrlConfig),
    ]);

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <p>
          {t("haveAccount")}{" "}
          <Link href="/sign-in" className="text-foreground underline">
            {t("signIn")}
          </Link>
        </p>
      }
    >
      {signUpFormShown(mode, invitation) ? (
        <div className="flex flex-col gap-4">
          <FormError
            error={Option.getOrNull(
              providerErrorKey(error, {
                fromProvider: cameFromProvider(from),
                providersOffered: providers.length > 0,
                signUpOffered: true,
              })
            )}
          />
          <ProviderButtons
            providers={providers}
            returnTo={signUpReturn(invitationId, (href) =>
              getPathname({ href, locale })
            )}
          />
          <SignUpForm
            captchaSiteKey={Option.getOrNull(siteKey)}
            invitationId={invitationId}
            termsUrl={termsUrl}
            privacyUrl={privacyUrl}
          />
        </div>
      ) : (
        <SignUpByInvitation />
      )}
    </AuthCard>
  );
};

export default SignUpPage;
