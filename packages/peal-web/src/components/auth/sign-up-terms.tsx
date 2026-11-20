import { useTranslations } from "next-intl";
import type { ReactElement, ReactNode } from "react";

// A legal page's link, or its words alone where the server names none.
const legalLink = (href: string | null) => {
  const LegalLink = (chunks: ReactNode): ReactElement =>
    href === null ? (
      <span>{chunks}</span>
    ) : (
      <a className="text-foreground" href={href}>
        {chunks}
      </a>
    );

  return LegalLink;
};

/**
 * What signing up accepts, under every way to sign up: the terms of
 * service at `PEAL_TERMS_URL` and, when set, the privacy policy at
 * `PEAL_PRIVACY_URL` (`#billing/terms.ts`).
 */
export const SignUpTerms = ({
  privacyUrl,
  termsUrl,
}: {
  readonly privacyUrl: string | null;
  readonly termsUrl: string | null;
}) => {
  const t = useTranslations("SignUpPage");

  return (
    <p className="text-muted-foreground text-center text-sm text-balance">
      {privacyUrl === null
        ? t.rich("termsOnly", { terms: legalLink(termsUrl) })
        : t.rich("terms", {
            privacy: legalLink(privacyUrl),
            terms: legalLink(termsUrl),
          })}
    </p>
  );
};
