import { DateTime } from "effect";
import { NewspaperIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ArticleSummary, Channel } from "peal-contract";
import { cn } from "peal-ui/lib/utils";

import { channelName } from "#channels/channel-name.ts";
import type { ViewLink } from "#components/posts/calendar-toolbar.tsx";
import { useTimeOptions } from "#i18n/hour-cycle.ts";

/**
 * An article on the calendar: a post's chip in its state's tint (`tone`),
 * a link to its editor, a mark that names its website, and no handle: its
 * time changes in its editor. Its link comes from the screen, so the view
 * renders outside Next.
 */
export const CalendarArticleChip = ({
  article,
  at,
  href,
  link: Link,
  sites,
  timeZone,
  tone,
}: {
  readonly article: ArticleSummary;
  readonly at: DateTime.Utc;
  /** The article's editor. */
  readonly href: string;
  readonly link: ViewLink;
  /** The workspace's websites, which name the article's. */
  readonly sites: readonly Channel[];
  readonly timeZone: string;
  /** The tint of the post state the article's reads as. */
  readonly tone: string;
}) => {
  const t = useTranslations("Posts.Calendar");
  const tArticles = useTranslations("Articles.list");
  const tPosts = useTranslations("Posts");
  const format = useFormatter();
  const timeOptions = useTimeOptions();
  const site = sites.find(({ id }) => id === article.channelId);

  const removed =
    article.state._tag === "published" && article.state.removedAt !== null;

  const time = format.dateTime(DateTime.toDate(at), {
    timeStyle: "short",
    timeZone,
    ...timeOptions,
  });

  const title = article.title.trim();
  const shown = title === "" ? tArticles("untitled") : title;

  // A website no longer connected, or not read yet, as the list says it.
  const mark =
    site === undefined
      ? tPosts("disconnectedChannel")
      : t("articleMark", { site: channelName(site) });

  const label = t("postLabel", {
    status: removed
      ? tArticles("removed")
      : tArticles(`state.${article.state._tag}`),
    text: shown,
    time,
  });

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs",
        tone,
        // In the site's trash: kept, dimmed.
        removed ? "opacity-60" : null
      )}
    >
      <Link
        href={href}
        className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
        aria-label={`${label} ${mark}`}
      >
        {t("post", { text: shown, time })}
      </Link>
      <span title={mark} className="text-muted-foreground shrink-0">
        <NewspaperIcon aria-hidden className="size-3" />
        <span className="sr-only">{mark}</span>
      </span>
    </div>
  );
};
