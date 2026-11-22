import { Option, Schema } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "#components/auth/auth-card.tsx";
import { ConfirmEmail } from "#components/auth/confirm-email.tsx";
import { ResendVerificationForm } from "#components/auth/resend-verification-form.tsx";

// The token in the address goes into no Referer, as next.config.ts also
// says for this page.
export const metadata: Metadata = { referrer: "no-referrer" };

const decodeToken = Schema.decodeUnknownOption(Schema.NonEmptyString);

// Where the confirmation link lands, with the emailed token. Opening it
// confirms nothing: the page posts the token from the browser
// (`ConfirmEmail`), which signs in only the browser that signed up. With
// no token, it offers a new link.
const VerifyEmailPage = async ({
  searchParams,
}: PageProps<"/[locale]/verify-email">) => {
  const query = await searchParams;
  const token = decodeToken(query["token"]);
  const t = await getTranslations("VerifyEmailPage");

  if (Option.isSome(token)) {
    return <ConfirmEmail token={token.value} />;
  }

  return (
    <AuthCard title={t("invalidTitle")} description={t("invalidDescription")}>
      <ResendVerificationForm />
    </AuthCard>
  );
};

export default VerifyEmailPage;
