import { Effect } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { AdsScreen } from "#components/ads/ads-screen.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { docsUrlConfig } from "#shell/docs-url.ts";

// A workspace's ad accounts, their campaigns and what they spent, for
// members who may read its ads. Connecting takes ads:manage, and deciding
// what an account may spend ads:authorize, which owners hold.
const AdsPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/ads">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!may.has("ads:read")) {
    notFound();
  }

  const docsUrl = await Effect.runPromise(docsUrlConfig);

  return (
    <AdsScreen
      docsUrl={
        docsUrl === null
          ? null
          : new URL(
              locale === "fr"
                ? "fr/guides/engage/ads#google"
                : "guides/engage/ads#google",
              docsUrl.endsWith("/") ? docsUrl : `${docsUrl}/`
            ).href
      }
      workspaceId={workspace.id}
      rights={{
        authorize: may.has("ads:authorize"),
        manage: may.has("ads:manage"),
      }}
    />
  );
};

export default AdsPage;
