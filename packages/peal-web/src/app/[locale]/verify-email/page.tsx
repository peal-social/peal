import { getTranslations } from "next-intl/server";
import { buttonVariants } from "peal-ui/components/button";

import { AuthCard } from "#components/auth/auth-card.tsx";
import { ResendVerificationForm } from "#components/auth/resend-verification-form.tsx";
import { Link } from "#i18n/navigation.ts";

// Where the confirmation link lands. Better Auth has already checked the
// token: it signed in the browser that signed up, or added ?error= when the
// link was invalid or expired. Opened in another browser, the link confirms
// the address without signing anyone in, and the account keeps no password
// (?password=needed): the person sets one through the reset flow.
const VerifyEmailPage = async ({
  searchParams,
}: PageProps<"/[locale]/verify-email">) => {
  const { error, password } = await searchParams;
  const t = await getTranslations("VerifyEmailPage");

  if (error !== undefined) {
    return (
      <AuthCard title={t("invalidTitle")} description={t("invalidDescription")}>
        <ResendVerificationForm />
      </AuthCard>
    );
  }

  if (password === "needed") {
    return (
      <AuthCard title={t("title")} description={t("passwordNeededDescription")}>
        <Link href="/forgot-password" className={buttonVariants()}>
          {t("choosePassword")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <Link href="/" className={buttonVariants()}>
        {t("continue")}
      </Link>
    </AuthCard>
  );
};

export default VerifyEmailPage;
