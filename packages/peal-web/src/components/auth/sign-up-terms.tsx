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

/** Which documents besides the terms the sentence names. */
export const documentsOf = (
  privacyUrl: string | null,
  dpaUrl: string | null
): "dpa" | "none" | "privacy" | "privacyAndDpa" => {
  if (privacyUrl === null) {
    return dpaUrl === null ? "none" : "dpa";
  }

  return dpaUrl === null ? "privacy" : "privacyAndDpa";
};

/**
 * What signing up accepts, under every way to sign up: the terms of
 * service at `PEAL_TERMS_URL` and, when set, the privacy policy at
 * `PEAL_PRIVACY_URL` and the data processing agreement at `PEAL_DPA_URL`
 * (`#billing/terms.ts`). The sign-in page says it of its providers alone
 * (`providerTerms`), which make an account there.
 */
export const SignUpTerms = ({
  dpaUrl,
  message = "terms",
  privacyUrl,
  termsUrl,
}: {
  readonly dpaUrl: string | null;
  readonly message?: "providerTerms" | "terms";
  readonly privacyUrl: string | null;
  readonly termsUrl: string | null;
}) => {
  const t = useTranslations("SignUpPage");

  return (
    <p className="text-muted-foreground text-center text-sm text-balance">
      {t.rich(message, {
        documents: documentsOf(privacyUrl, dpaUrl),
        dpa: legalLink(dpaUrl),
        privacy: legalLink(privacyUrl),
        terms: legalLink(termsUrl),
      })}
    </p>
  );
};
