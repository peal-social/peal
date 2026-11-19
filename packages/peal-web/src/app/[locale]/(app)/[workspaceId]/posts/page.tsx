import { Schema } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { PostList } from "#components/posts/post-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";

const isText = Schema.is(Schema.String);

// The workspace's posts, whatever their state, filtered and ordered by the
// query string (`#posts/post-list-filter.ts`), each opening on its page.
// The search needs post:read and channel:read: anyone else finds no page.
const PostsPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/posts">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const membership = await membershipOf(locale, workspaceId);

  if (
    !(
      membership.permissions.includes("post:read") &&
      membership.permissions.includes("channel:read")
    )
  ) {
    notFound();
  }

  // Only single values are filters; a name given twice is ignored.
  const query = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([name, value]) =>
      isText(value) ? [[name, value]] : []
    )
  ).toString();

  // The panel's header names the page (DESIGN.md, "The frame").
  return (
    <PostList
      canCreate={membership.permissions.includes("post:create")}
      canImport={membership.permissions.includes("post:schedule")}
      permissions={membership.permissions}
      query={query}
      workspaceId={membership.id}
    />
  );
};

export default PostsPage;
