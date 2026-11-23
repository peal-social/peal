import { Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { FeedsSettings } from "#components/feeds/feeds-settings.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

const decodeFeed = Schema.decodeUnknownOption(Schema.String);

// A workspace's feeds, for members who may read its posts. Adding,
// pausing, resuming or deleting one takes post:create, and a feed that
// puts posts on a queue post:schedule; `feed` marks the one a notice
// opened the page for.
const FeedsPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/settings/feeds">) => {
  const { locale, workspaceId } = await params;
  const { feed } = await searchParams;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const workspace = await membershipOf(locale, workspaceId);
  const may = new Set(workspace.permissions);

  if (!may.has("post:read")) {
    notFound();
  }

  return (
    <FeedsSettings
      workspaceId={workspace.id}
      mayChange={may.has("post:create")}
      mayQueue={may.has("post:schedule")}
      highlighted={Option.getOrNull(decodeFeed(feed))}
    />
  );
};

export const generateMetadata = workspacePageTitle("feeds");

export default FeedsPage;
