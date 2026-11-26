"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { FileUpIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  ArticleSummary,
  Channel,
  Permission,
  Post,
  Queue,
  SocialChannel,
  Tag,
} from "peal-contract";
import { Button, buttonVariants } from "peal-ui/components/button";
import { Checkbox } from "peal-ui/components/checkbox";
import { ListViews, viewTabClass } from "peal-ui/components/list-toolbar";
import { Skeleton } from "peal-ui/components/skeleton";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { workspaceArticles, workspaceSites } from "#articles/api.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { PostDecisionActions } from "#components/posts/post-decision-actions.tsx";
import { PostListToolbar } from "#components/posts/post-list-toolbar.tsx";
import { PostSelectionBar } from "#components/posts/post-selection-bar.tsx";
import { usePostsLayouts } from "#components/posts/posts-layouts.ts";
import { useChoosing } from "#components/posts/use-choosing.ts";
import type { Choosing } from "#components/posts/use-choosing.ts";
import { PostDecisionsProvider } from "#components/review/post-decisions-provider.tsx";
import { PageActions } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link, useRouter } from "#i18n/navigation.ts";
import { postSearchPage, workspaceChannels } from "#posts/api.ts";
import {
  listedArticles,
  pageRows,
  postPlace,
} from "#posts/articles-among-posts.ts";
import type { Place, PostsRow } from "#posts/articles-among-posts.ts";
import {
  filtersOf,
  isFilteringView,
  postViews,
  queryOf,
  withFilter,
} from "#posts/post-list-filter.ts";
import type { PostListFilters } from "#posts/post-list-filter.ts";
import { workspaceQueues } from "#queues/atoms.ts";
import { workspaceTags } from "#tags/atoms.ts";
import { tagsOf } from "#tags/post-tags.ts";

import {
  ArticleItemView,
  PostItemView,
  PostListEmpty,
  PostListFailed,
  useArticleTitle,
  usePostTitle,
} from "./post-list-views.tsx";

const noChannels: readonly SocialChannel[] = [];

const noTags: readonly Tag[] = [];

const noQueues: readonly Queue[] = [];

/**
 * One post, opening on its page, with its checkbox where posts are chosen,
 * and Approve and Request changes on one that waits, for who may approve.
 */
const PostItem = ({
  canApprove,
  channels,
  choosing,
  post,
  tags,
  workspaceId,
}: {
  /** Whether the member may approve, which a post that waits offers. */
  readonly canApprove: boolean;
  readonly channels: readonly SocialChannel[];
  readonly choosing: Choosing | null;
  readonly post: Post;
  readonly tags: readonly Tag[];
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Posts.Selection");
  const title = usePostTitle(post);
  const chosen = choosing?.chosen.has(post.id) ?? false;

  return (
    <PostItemView
      channels={channels}
      post={post}
      focused={choosing?.focused === post.id}
      selected={chosen}
      tags={tagsOf(post.tagIds, tags)}
      trailing={
        canApprove && post.status === "awaitingApproval" ? (
          <PostDecisionActions
            post={post}
            title={title}
            workspaceId={workspaceId}
          />
        ) : null
      }
      onPointerEnter={() => {
        choosing?.onFocus(post.id);
      }}
      onClickCapture={(event) => {
        // Shift with a click anywhere on the row chooses the range from
        // the last post clicked, and opens nothing.
        if (choosing !== null && event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          choosing.onToggle(post.id, true);
        }
      }}
      leading={
        choosing === null ? null : (
          <Checkbox
            aria-label={t("choose", { post: title })}
            checked={chosen}
            onCheckedChange={() => {
              choosing.onToggle(post.id, false);
            }}
          />
        )
      }
    >
      <Link
        href={workspaceHref(workspaceId, `/posts/${post.id}`)}
        dir="auto"
        className="line-clamp-2 font-medium underline-offset-4 hover:underline"
      >
        {title}
      </Link>
    </PostItemView>
  );
};

/** One article, opening in its editor. */
const ArticleItem = ({
  article,
  sites,
  workspaceId,
}: {
  readonly article: ArticleSummary;
  readonly sites: readonly Channel[];
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();

  return (
    <ArticleItemView article={article} sites={sites}>
      <Link
        href={workspaceHref(workspaceId, `/articles/${article.id}`)}
        dir="auto"
        className="line-clamp-2 font-medium underline-offset-4 hover:underline"
      >
        {useArticleTitle(article)}
      </Link>
    </ArticleItemView>
  );
};

/** What the rows need beside themselves. */
interface RowsContext {
  readonly canApprove: boolean;
  readonly channels: readonly SocialChannel[];
  readonly choosing: Choosing | null;
  readonly sites: readonly Channel[];
  readonly tags: readonly Tag[];
  readonly workspaceId: string;
}

// A page's rows, its posts and the articles among them.
const Rows = ({
  context,
  rows,
}: {
  readonly context: RowsContext;
  readonly rows: readonly PostsRow[];
}) => (
  <ul className="bg-card divide-y overflow-hidden rounded-xl border">
    {rows.map((row) =>
      row._tag === "post" ? (
        <PostItem
          key={row.post.id}
          canApprove={context.canApprove}
          channels={context.channels}
          choosing={context.choosing}
          post={row.post}
          tags={context.tags}
          workspaceId={context.workspaceId}
        />
      ) : (
        <ArticleItem
          key={row.article.id}
          article={row.article}
          sites={context.sites}
          workspaceId={context.workspaceId}
        />
      )
    )}
  </ul>
);

const LoadingList = () => {
  const t = useTranslations("Posts.List");

  return (
    <div className="flex flex-col gap-3" aria-busy>
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
};

/** The empty list's next steps, for a member who may write. */
interface EmptyActions {
  readonly newArticle: ReactNode;
  readonly newPost: ReactNode;
}

// The list when its first page holds no row.
const EmptyList = ({
  actions,
  filters,
  workspaceId,
}: {
  readonly actions: EmptyActions;
  readonly filters: PostListFilters;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Posts.List");
  const articles = filters.type === "article";

  return (
    <PostListEmpty
      articles={articles}
      filtering={isFilteringView(
        articles ? withFilter(filters, "type", undefined) : filters
      )}
      view={
        postViews.find(({ status }) => status === filters.status)?.view ?? "all"
      }
      newArticle={actions.newArticle}
      newPost={actions.newPost}
      clearFilters={
        <Link
          href={workspaceHref(workspaceId, "/posts")}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          {t("clearFilters")}
        </Link>
      }
    />
  );
};

interface PagesProps {
  /** Where the page before ended, none on the first page. */
  readonly after: Place | undefined;
  /** The articles the filters keep, which the pages place among posts. */
  readonly articles: readonly ArticleSummary[];
  readonly context: RowsContext;
  readonly cursor: Option.Option<string>;
  /** The page's place: 0 for the first, then one more for each after it. */
  readonly depth: number;
  /** The empty state's next steps, on the first page. */
  readonly emptyActions: EmptyActions;
  readonly filters: PostListFilters;
  // How many pages to show after this one.
  readonly more: number;
  readonly onMore: () => void;
  /** Hears the posts a page shows, so the list knows them in order. */
  readonly onPosts: (depth: number, posts: readonly Post[]) => void;
}

// A page of posts with the articles that sort among them, then the pages
// after it that "Show more" opened, each asked with the same filters and
// sort as the cursor needs.
const PostPages = ({
  after,
  articles,
  context,
  cursor,
  depth,
  emptyActions,
  filters,
  more,
  onMore,
  onPosts,
}: PagesProps) => {
  const t = useTranslations("Posts.List");
  const page = postSearchPage(context.workspaceId, filters, cursor);
  const result = useAtomValue(page);
  const reload = useAtomRefresh(page);
  const shown = Option.getOrUndefined(AsyncResult.value(result))?.items;

  useEffect(() => {
    if (shown !== undefined) {
      onPosts(depth, shown);
    }
  }, [depth, onPosts, shown]);

  return AsyncResult.match(result, {
    onFailure: () => <PostListFailed onRetry={reload} />,
    onInitial: () => <LoadingList />,
    onSuccess: ({ value }) => {
      const next = Option.fromNullOr(value.nextCursor);
      const last = value.items.at(-1);

      const rows = pageRows({
        after,
        articles,
        more: Option.isSome(next),
        posts: value.items,
        sort: filters.sort,
      });

      if (Option.isNone(cursor) && rows.length === 0) {
        return (
          <EmptyList
            actions={emptyActions}
            filters={filters}
            workspaceId={context.workspaceId}
          />
        );
      }

      return (
        <>
          <Rows context={context} rows={rows} />
          {Option.isSome(next) && more > 0 ? (
            <PostPages
              after={last === undefined ? after : postPlace(last)}
              articles={articles}
              context={context}
              cursor={next}
              depth={depth + 1}
              emptyActions={emptyActions}
              filters={filters}
              more={more - 1}
              onMore={onMore}
              onPosts={onPosts}
            />
          ) : null}
          {Option.isSome(next) && more === 0 ? (
            <Button variant="outline" className="self-center" onClick={onMore}>
              {t("loadMore")}
            </Button>
          ) : null}
        </>
      );
    },
  });
};

// The articles alone (Type, Article): no post is asked for.
const ArticleRows = ({
  articles,
  context,
  emptyActions,
  filters,
}: {
  readonly articles: readonly ArticleSummary[];
  readonly context: RowsContext;
  readonly emptyActions: EmptyActions;
  readonly filters: PostListFilters;
}) => {
  const rows = pageRows({
    after: undefined,
    articles,
    more: false,
    posts: [],
    sort: filters.sort,
  });

  return rows.length === 0 ? (
    <EmptyList
      actions={emptyActions}
      filters={filters}
      workspaceId={context.workspaceId}
    />
  ) : (
    <Rows context={context} rows={rows} />
  );
};

// The list's rows, once every article and the websites are read: the
// pages place the articles among their posts, or show them alone.
const ListRows = ({
  context,
  emptyActions,
  filters,
  more,
  onMore,
  onPosts,
}: {
  readonly context: Omit<RowsContext, "sites">;
  readonly emptyActions: EmptyActions;
  readonly filters: PostListFilters;
  readonly more: number;
  readonly onMore: () => void;
  readonly onPosts: (depth: number, posts: readonly Post[]) => void;
}) => {
  const articlesQuery = workspaceArticles(context.workspaceId);
  const sitesQuery = workspaceSites(context.workspaceId);
  const articles = useAtomValue(articlesQuery);
  const sites = useAtomValue(sitesQuery);
  const reloadArticles = useAtomRefresh(articlesQuery);
  const reloadSites = useAtomRefresh(sitesQuery);

  return AsyncResult.match(AsyncResult.all([articles, sites]), {
    onFailure: () => (
      <PostListFailed
        onRetry={() => {
          reloadArticles();
          reloadSites();
        }}
      />
    ),
    onInitial: () => <LoadingList />,
    onSuccess: ({ value: [{ items }, websites] }) => {
      const kept = listedArticles(filters, items);
      const full = { ...context, sites: websites };

      return filters.type === "article" ? (
        <ArticleRows
          articles={kept}
          context={full}
          emptyActions={emptyActions}
          filters={filters}
        />
      ) : (
        <PostPages
          after={undefined}
          articles={kept}
          context={full}
          cursor={Option.none()}
          depth={0}
          emptyActions={emptyActions}
          filters={filters}
          more={more}
          onMore={onMore}
          onPosts={onPosts}
        />
      );
    },
  });
};

// Whether the member may do anything to several posts at once.
const choosesPosts = (permissions: readonly Permission[]): boolean =>
  permissions.includes("post:update") ||
  permissions.includes("post:schedule") ||
  permissions.includes("post:approve");

const LoadedList = ({
  emptyActions,
  filters,
  permissions,
  workspaceId,
}: {
  /** The empty list's next steps, for a member who may write. */
  readonly emptyActions: EmptyActions;
  readonly filters: PostListFilters;
  readonly permissions: readonly Permission[];
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const t = useTranslations("Posts.List");
  // The pages "Show more" opened, for the filters they were opened with.
  const [more, setMore] = useState({ count: 0, query: queryOf(filters) });
  const query = queryOf(filters);
  const shown = more.query === query ? more.count : 0;

  // The posts each page shows, by its place, and the choice among them,
  // both for the filters they were made with.
  const [listed, setListed] = useState<{
    readonly pages: Readonly<Record<number, readonly Post[]>>;
    readonly query: string;
  }>({ pages: {}, query });

  const pages = listed.query === query ? listed.pages : {};

  const order = Object.keys(pages)
    .map(Number)
    .toSorted((left, right) => left - right)
    .flatMap((depth) => pages[depth] ?? []);

  const { choosing, clear, selection } = useChoosing({
    allowed: choosesPosts(permissions),
    onOpen: (postId) => {
      router.push(workspaceHref(workspaceId, `/posts/${postId}`));
    },
    order: order.map(({ id }) => id),
    query,
  });

  const chosenPosts = order.filter(({ id }) => selection.ids.has(id));

  const handlePosts = useCallback(
    (depth: number, posts: readonly Post[]) => {
      setListed((current) => {
        const kept = current.query === query ? current.pages : {};

        return { pages: { ...kept, [depth]: posts }, query };
      });
    },
    [query, setListed]
  );

  const channels = Option.getOrElse(
    AsyncResult.value(useAtomValue(workspaceChannels(workspaceId))),
    () => noChannels
  );

  const tags = Option.getOrElse(
    AsyncResult.value(useAtomValue(workspaceTags(workspaceId))),
    () => noTags
  );

  const queues = Option.getOrElse(
    AsyncResult.value(useAtomValue(workspaceQueues(workspaceId))),
    () => noQueues
  );

  const layouts = usePostsLayouts("list");

  const handleFilters = (next: PostListFilters) => {
    const written = queryOf(next);

    // The page stays where it is, and so does an open Filter or Display.
    router.replace(
      written === ""
        ? workspaceHref(workspaceId, "/posts")
        : workspaceHref(workspaceId, `/posts?${written}`),
      { scroll: false }
    );
  };

  const handleMore = () => {
    setMore({ count: shown + 1, query });
  };

  // The tabs: each keeps the other filters and sets the status.
  const views = (
    <ListViews aria-label={t("views")}>
      {postViews.map(({ status, view }) => {
        const written = queryOf(withFilter(filters, "status", status));
        const current = filters.status === status;

        return (
          <Link
            key={view}
            href={
              written === ""
                ? workspaceHref(workspaceId, "/posts")
                : workspaceHref(workspaceId, `/posts?${written}`)
            }
            scroll={false}
            className={viewTabClass(current)}
            {...(current ? { "aria-current": "page" as const } : {})}
          >
            {t("view", { view })}
          </Link>
        );
      })}
    </ListViews>
  );

  const list = (
    <>
      <PostListToolbar
        actions={null}
        channels={channels}
        filters={filters}
        layouts={layouts}
        queues={queues}
        tags={tags}
        views={views}
        onChange={handleFilters}
      />
      <ListRows
        context={{
          canApprove: permissions.includes("post:approve"),
          channels,
          choosing,
          tags,
          workspaceId,
        }}
        emptyActions={emptyActions}
        filters={filters}
        more={shown}
        onMore={handleMore}
        onPosts={handlePosts}
      />
      {chosenPosts.length === 0 ? null : (
        <PostSelectionBar
          permissions={permissions}
          posts={chosenPosts}
          tags={tags}
          workspaceId={workspaceId}
          onClear={clear}
        />
      )}
    </>
  );

  // Decisions on the posts that wait, for a member who may approve: the
  // rows and the choice share them, one at a time.
  return permissions.includes("post:approve") ? (
    <PostDecisionsProvider workspaceId={workspaceId}>
      {list}
    </PostDecisionsProvider>
  ) : (
    list
  );
};

/**
 * The posts page's actions, in the panel's header (DESIGN.md, "The
 * frame"), whatever its layout: Import posts, New post and New article,
 * for members who may.
 */
export const PostsActions = ({
  canCreate,
  canImport,
  workspaceId,
}: {
  readonly canCreate: boolean;
  /** Whether the member may schedule posts, as an import does. */
  readonly canImport: boolean;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Posts.List");

  return (
    <PageActions>
      {canImport ? (
        <Link
          href={workspaceHref(workspaceId, "/posts/import")}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <FileUpIcon aria-hidden />
          {t("importPosts")}
        </Link>
      ) : null}
      {canCreate ? (
        <Link
          href={workspaceHref(workspaceId, "/posts/new")}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <PlusIcon aria-hidden />
          {t("newPost")}
        </Link>
      ) : null}
      {canCreate ? (
        <Link
          href={workspaceHref(workspaceId, "/articles/new")}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <PlusIcon aria-hidden />
          {t("newArticle")}
        </Link>
      ) : null}
    </PageActions>
  );
};

/**
 * The workspace's posts, whatever their state, a page at a time, as the
 * filters in the page's query string keep and order them, so a link shows
 * the same list; with a way to write a new post, and to import posts from
 * a CSV file, for members who may.
 */
export const PostList = ({
  canCreate,
  canImport,
  permissions,
  query,
  workspaceId,
}: {
  readonly canCreate: boolean;
  /** Whether the member may schedule posts, as an import does. */
  readonly canImport: boolean;
  readonly permissions: readonly Permission[];
  /** The page's query string, which holds the filters. */
  readonly query: string;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Posts.List");
  // The posts are read with the visitor's cookies, which only the browser
  // sends.
  const hydrated = useHydrated();

  return (
    <section className="flex flex-col gap-4">
      <PostsActions
        canCreate={canCreate}
        canImport={canImport}
        workspaceId={workspaceId}
      />
      {hydrated ? (
        <LoadedList
          emptyActions={{
            newArticle: canCreate ? (
              <Link
                href={workspaceHref(workspaceId, "/articles/new")}
                className={buttonVariants()}
              >
                {t("newArticle")}
              </Link>
            ) : null,
            newPost: canCreate ? (
              <Link
                href={workspaceHref(workspaceId, "/posts/new")}
                className={buttonVariants()}
              >
                {t("newPost")}
              </Link>
            ) : null,
          }}
          filters={filtersOf(new URLSearchParams(query))}
          permissions={permissions}
          workspaceId={workspaceId}
        />
      ) : (
        <LoadingList />
      )}
    </section>
  );
};
