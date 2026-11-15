import { Option, Schema } from "effect";
import { getTranslations } from "next-intl/server";
import { SiteSignInCallbackSchema } from "peal-contract";

import { AuthCard } from "#components/auth/auth-card.tsx";
import { CompleteSiteSignIn } from "#components/channels/complete-site-sign-in.tsx";

const decodeCallback = Schema.decodeUnknownOption(SiteSignInCallbackSchema);

// Where WordPress.com sends the browser back after a member signs in
// there, with the state, and a code or an error, in the address: the
// redirect URI Peal registers is this page, for every workspace.
const WordPressComCallbackPage = async ({
  searchParams,
}: PageProps<"/[locale]/connect/wordpress-com/callback">) => {
  const callback = decodeCallback(await searchParams);
  const t = await getTranslations("ConnectCallbackPage");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <CompleteSiteSignIn
        platform="wordpressCom"
        callback={Option.getOrNull(callback)}
      />
    </AuthCard>
  );
};

export default WordPressComCallbackPage;
