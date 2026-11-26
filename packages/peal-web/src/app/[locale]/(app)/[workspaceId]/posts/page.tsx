import { Option, Schema } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { CalendarScreen } from "#components/posts/calendar-screen.tsx";
import { PostList, PostsActions } from "#components/posts/post-list.tsx";
import { routing } from "#i18n/routing.ts";
import { membershipOf } from "#posts/membership.ts";
import { layoutOf } from "#posts/posts-layout.ts";
import { DateKeySchema, parseDate } from "#posts/zoned-time.ts";
import { workspacePageTitle } from "#shell/page-title.ts";

const isText = Schema.is(Schema.String);
const decodeDateKey = Schema.decodeUnknownOption(DateKeySchema);

// The workspace's posts, whatever their state, in the layout the query
// string names (`#posts/posts-layout.ts`): the list, filtered and ordered
// by the query string (`#posts/post-list-filter.ts`), each opening on its
// page; or the calendar (`?layout=calendar`), by day, week or month,
// `?date=YYYY-MM-DD` opening on the week of that date. The search needs
// post:read and channel:read: anyone else finds no page.
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
  );

  const canCreate = membership.permissions.includes("post:create");
  const canImport = membership.permissions.includes("post:schedule");

  // The panel's header names the page (DESIGN.md, "The frame").
  if (layoutOf(query) === "calendar") {
    return (
      <section className="flex flex-col gap-4">
        <PostsActions
          canCreate={canCreate}
          canImport={canImport}
          workspaceId={membership.id}
        />
        <CalendarScreen
          initialDate={Option.getOrUndefined(
            decodeDateKey(query.get("date")).pipe(Option.flatMap(parseDate))
          )}
          permissions={membership.permissions}
          workspaceId={membership.id}
        />
      </section>
    );
  }

  return (
    <PostList
      canCreate={canCreate}
      canImport={canImport}
      permissions={membership.permissions}
      query={query.toString()}
      workspaceId={membership.id}
    />
  );
};

export const generateMetadata = workspacePageTitle("posts");

export default PostsPage;
