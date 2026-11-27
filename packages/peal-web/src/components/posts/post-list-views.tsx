"use client";

import { DateTime } from "effect";
import { NewspaperIcon, SquarePenIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  ArticleSummary,
  Channel,
  SocialChannel,
  Post,
  Tag,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateHidden,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import type { MouseEvent, ReactNode } from "react";

import { channelName } from "#channels/channel-name.ts";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { TagList } from "#components/tags/tag-views.tsx";
import { useTimeOptions } from "#i18n/hour-cycle.ts";
import type { PostView } from "#posts/post-list-filter.ts";

// Views of the posts list, which take their links as props or children,
// so tests render each state without Next.

/** What a post is called in the list: the start of its text. */
export const usePostTitle = (post: Post): string => {
  const t = useTranslations("Posts.List");
  const text = post.content.text.trim();

  return text === "" ? t("noText") : text;
};

const noTags: readonly Tag[] = [];

// A row of the list, a post's or an article's.
const rowClass =
  "group/row data-[focused]:bg-muted/60 data-[selected]:bg-brand-tint data-[focused]:data-[selected]:bg-brand-tint flex gap-3 px-4 py-3 transition-colors";

// A row's time in the reader's zone, or that it has none yet.
const useListTime = () => {
  const t = useTranslations("Posts.List");
  const format = useFormatter();
  const timeOptions = useTimeOptions();

  return (at: DateTime.Utc | null): string =>
    at === null
      ? t("noTime")
      : format.dateTime(DateTime.toDate(at), {
          dateStyle: "medium",
          timeStyle: "short",
          ...timeOptions,
        });
};

/**
 * One post: its title (`children`, which links it to its page), its time
 * in the reader's zone, its status and, once finished, its outcome, its
 * channels by name and its tags, then what `trailing` offers.
 */
export const PostItemView = ({
  channels,
  children,
  focused = false,
  leading = null,
  onClickCapture,
  onPointerEnter,
  post,
  selected = false,
  tags = noTags,
  trailing = null,
}: {
  /** The workspace's channels, which name the post's. */
  readonly channels: readonly SocialChannel[];
  readonly children: ReactNode;
  /** Before the post, like the checkbox that chooses it. */
  readonly leading?: ReactNode;
  /** Whether the post is chosen, which tints its row. */
  readonly selected?: boolean;
  /** Whether the keys act on this row: the pointer's, or J and K's. */
  readonly focused?: boolean;
  /** A click anywhere on the row, before its link hears it. */
  readonly onClickCapture?: (event: MouseEvent<HTMLLIElement>) => void;
  readonly onPointerEnter?: () => void;
  readonly post: Post;
  /** The post's tags, among the workspace's. */
  readonly tags?: readonly Tag[];
  /** At the row's end: what may be decided on a post that waits. */
  readonly trailing?: ReactNode;
}) => {
  const t = useTranslations("Posts.List");
  const tPosts = useTranslations("Posts");
  const time = useListTime();

  // A channel taken off the post is none of its channels.
  const named = post.targets.flatMap(({ channelId, dropped }) => {
    if (dropped === true) {
      return [];
    }

    const channel = channels.find(({ id }) => id === channelId);

    return [
      channel === undefined
        ? tPosts("disconnectedChannel")
        : channelName(channel),
    ];
  });

  return (
    <li
      data-post-row={post.id}
      data-selected={selected ? "" : undefined}
      data-focused={focused ? "" : undefined}
      className={rowClass}
      onPointerEnter={onPointerEnter}
      onClickCapture={onClickCapture}
    >
      {leading === null ? null : (
        // Shown on the focused row (which the pointer moves), on a chosen
        // one, on keyboard focus, and always on a touch screen.
        <div className="pt-0.5 opacity-0 transition-opacity group-data-[focused]/row:opacity-100 group-data-[selected]/row:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          {leading}
        </div>
      )}
      {/* What the row offers takes a line of its own under the post on a
          phone, and sits at the row's end from 640 px. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {children}
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>{time(post.schedule?.at ?? null)}</span>
            <Badge variant="outline">
              {tPosts("status", { status: post.status })}
            </Badge>
            {post.outcome === null ? null : (
              <Badge
                variant={
                  post.outcome === "failed" ? "destructive" : "secondary"
                }
              >
                {tPosts("outcome", { outcome: post.outcome })}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            <span className="sr-only">{t("channels")}: </span>
            {named.length === 0 ? t("noChannel") : named.join(" · ")}
          </p>
          <TagList label={t("tags")} tags={tags} />
        </div>
        {trailing}
      </div>
    </li>
  );
};

/** What an article is called in the list: its title, or Untitled. */
export const useArticleTitle = (article: ArticleSummary): string => {
  const t = useTranslations("Articles.list");
  const title = article.title.trim();

  return title === "" ? t("untitled") : title;
};

/**
 * One article, as a post's row: its title (`children`, which links it to
 * its editor), its time, its state in the article's own words, then its
 * website, the platform's mark before its name. It is never chosen.
 */
export const ArticleItemView = ({
  article,
  children,
  choosing = false,
  sites,
}: {
  readonly article: ArticleSummary;
  readonly children: ReactNode;
  /** Whether the list's posts have checkboxes: the row keeps their room. */
  readonly choosing?: boolean;
  /** The workspace's websites, which name the article's. */
  readonly sites: readonly Channel[];
}) => {
  const t = useTranslations("Posts.List");
  const tArticles = useTranslations("Articles.list");
  const tPosts = useTranslations("Posts");
  const time = useListTime();
  const { state } = article;
  const site = sites.find(({ id }) => id === article.channelId);
  const removed = state._tag === "published" && state.removedAt !== null;

  return (
    <li data-article-row={article.id} className={rowClass}>
      {choosing ? <div aria-hidden className="w-4 shrink-0" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {children}
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>{time(state._tag === "draft" ? null : state.scheduledAt)}</span>
          <Badge variant={state._tag === "failed" ? "destructive" : "outline"}>
            {removed ? tArticles("removed") : tArticles(`state.${state._tag}`)}
          </Badge>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span className="sr-only">{t("website")}: </span>
          {site === undefined ? (
            tPosts("disconnectedChannel")
          ) : (
            <>
              <PlatformMark platform={site.platform} />
              {channelName(site)}
            </>
          )}
        </p>
      </div>
    </li>
  );
};

/**
 * The list when it holds nothing (DESIGN.md, "Empty states"): the posts'
 * icon in pixels, then none yet, with how to write the first, or none the
 * filters keep, with Clear.
 */
export const PostListEmpty = ({
  articles = false,
  clearFilters,
  filtering,
  newArticle = null,
  newPost = null,
  view = "all",
}: {
  /** Whether the list shows the articles alone (Type, Article). */
  readonly articles?: boolean;
  /** A link that shows every post again, while filters narrow the list. */
  readonly clearFilters: ReactNode;
  readonly filtering: boolean;
  /** The next step when there is no article yet: New article. */
  readonly newArticle?: ReactNode;
  /** The next step when there is no post yet: New post, if allowed. */
  readonly newPost?: ReactNode;
  /** The tab the list shows, which names what it lacks ("No drafts"). */
  readonly view?: PostView;
}) => {
  const t = useTranslations("Posts.List");

  if (articles && !filtering) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={<NewspaperIcon />} />
        <EmptyStateTitle>{t("emptyArticlesTitle")}</EmptyStateTitle>
        <EmptyStateDescription>{t("emptyArticles")}</EmptyStateDescription>
        {newArticle === null ? null : (
          <EmptyStateActions>{newArticle}</EmptyStateActions>
        )}
      </EmptyState>
    );
  }

  return (
    <EmptyState>
      <EmptyStateIcon icon={<SquarePenIcon />} />
      {filtering ? (
        <>
          <EmptyStateTitle>{t("filteredEmptyTitle")}</EmptyStateTitle>
          <EmptyStateHidden>
            <span>{t("filteredEmpty")}</span>
            {clearFilters}
          </EmptyStateHidden>
        </>
      ) : (
        <>
          <EmptyStateTitle>
            {view === "all" ? t("emptyTitle") : t("emptyView", { view })}
          </EmptyStateTitle>
          <EmptyStateDescription>{t("empty")}</EmptyStateDescription>
          {newPost === null ? null : (
            <EmptyStateActions>{newPost}</EmptyStateActions>
          )}
        </>
      )}
    </EmptyState>
  );
};

/** The list could not be read: a line, and a way to ask again. */
export const PostListFailed = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}) => {
  const t = useTranslations("Posts.List");

  return (
    <Alert variant="destructive">
      <AlertDescription>
        <span className="flex flex-wrap items-center justify-between gap-2">
          {t("loadFailed")}
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("reload")}
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
};
