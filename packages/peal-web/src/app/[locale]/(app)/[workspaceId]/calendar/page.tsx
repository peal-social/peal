import { Schema } from "effect";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { calendarLayoutQuery } from "#posts/posts-layout.ts";
import { workspacePath } from "#shell/workspace-path.ts";

const isText = Schema.is(Schema.String);

// The calendar is the posts page's calendar layout: an older link to it
// (a bookmark, an email) opens there, with its view, date and filters.
const CalendarPage = async ({
  params,
  searchParams,
}: PageProps<"/[locale]/[workspaceId]/calendar">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const query = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([name, value]) =>
      isText(value) && name !== "layout" ? [[name, value]] : []
    )
  ).toString();

  return redirect({
    href: workspacePath(workspaceId, `/posts?${calendarLayoutQuery(query)}`),
    locale,
  });
};

export default CalendarPage;
