import { DateTime, Match, Schema } from "effect";
import type {
  ArticleSummary,
  Post,
  PostOutcome,
  PostSort,
  PostStatus,
} from "peal-contract";

/** What the posts page shows: its posts, its articles, or both. */
export const PostsTypeSchema = Schema.Literals(["post", "article"]);

export type PostsType = typeof PostsTypeSchema.Type;

/** What the posts page's filters say of an article. */
interface ArticleFilters {
  readonly channelId?: string;
  readonly outcome?: PostOutcome;
  readonly queueId?: string;
  readonly status?: PostStatus;
  readonly tagId?: string;
  readonly type?: PostsType;
}

/** A post's status and outcome, as the list's filters read them. */
interface PostStanding {
  readonly outcome?: PostOutcome;
  readonly status: PostStatus;
}

/**
 * What an article's state reads as among posts: a draft, scheduled and
 * publishing as themselves; on the site, failed and to check as finished,
 * with that outcome.
 */
export const articleStatusOf = (article: ArticleSummary): PostStanding =>
  Match.valueTags(article.state, {
    draft: (): PostStanding => ({ status: "draft" }),
    failed: (): PostStanding => ({ outcome: "failed", status: "finished" }),
    published: (): PostStanding => ({
      outcome: "published",
      status: "finished",
    }),
    publishing: (): PostStanding => ({ status: "publishing" }),
    scheduled: (): PostStanding => ({ status: "scheduled" }),
    unconfirmed: (): PostStanding => ({
      outcome: "unconfirmed",
      status: "finished",
    }),
  });

/**
 * The articles the filters keep: none when they keep posts alone, or name
 * a channel, a tag or a queue, which articles have none of; else those of
 * the status and the outcome.
 */
export const listedArticles = (
  filters: ArticleFilters,
  articles: readonly ArticleSummary[]
): readonly ArticleSummary[] => {
  if (
    filters.type === "post" ||
    filters.channelId !== undefined ||
    filters.tagId !== undefined ||
    filters.queueId !== undefined
  ) {
    return [];
  }

  return articles.filter((article) => {
    const { outcome, status } = articleStatusOf(article);

    return (
      (filters.status === undefined || filters.status === status) &&
      (filters.outcome === undefined || filters.outcome === outcome)
    );
  });
};

/** A row of the posts list: a post, or an article. */
export type PostsRow =
  | { readonly _tag: "post"; readonly post: Post }
  | { readonly _tag: "article"; readonly article: ArticleSummary };

/** Where a row sorts: its id, after its time for the orders by time. */
export interface Place {
  readonly at: number | null;
  readonly id: string;
}

const byTime = (sort: PostSort) =>
  sort === "scheduledAsc" || sort === "scheduledDesc";

const descending = (sort: PostSort) =>
  sort === "createdDesc" || sort === "scheduledDesc";

const articleAt = (article: ArticleSummary): number | null =>
  article.state._tag === "draft"
    ? null
    : DateTime.toEpochMillis(article.state.scheduledAt);

/** Where a post sorts. */
export const postPlace = (post: Post): Place => ({
  at: post.schedule === null ? null : DateTime.toEpochMillis(post.schedule.at),
  id: post.id,
});

const placeOf = (row: PostsRow): Place =>
  row._tag === "post"
    ? postPlace(row.post)
    : { at: articleAt(row.article), id: row.article.id };

// Ascending: by time first for the orders by time, then by id, as the
// server orders posts (ids are UUIDv7 in lowercase, so their strings sort
// as they were made).
const compare = (sort: PostSort, left: Place, right: Place): number => {
  const timed =
    byTime(sort) && left.at !== null && right.at !== null
      ? left.at - right.at
      : 0;

  if (timed !== 0) {
    return timed;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? -1 : 1;
};

// Whether `left` comes before `right` in the list's order.
const before = (sort: PostSort, left: Place, right: Place): boolean =>
  descending(sort)
    ? compare(sort, left, right) > 0
    : compare(sort, left, right) < 0;

/**
 * One page of the list: its posts, and the articles that sort between the
 * last post of the page before (`after`, none on the first page) and its
 * own last post (no end on the last page, `more` false), in the list's
 * order. An order by time leaves out the articles without one, as it does
 * posts, so no article shows twice or is skipped across pages.
 */
export const pageRows = ({
  after,
  articles,
  more,
  posts,
  sort,
}: {
  readonly after: Place | undefined;
  readonly articles: readonly ArticleSummary[];
  readonly more: boolean;
  readonly posts: readonly Post[];
  readonly sort: PostSort;
}): readonly PostsRow[] => {
  const last = posts.at(-1);
  const end = more && last !== undefined ? postPlace(last) : undefined;

  const between = articles
    .map((article): PostsRow => ({ _tag: "article", article }))
    .filter((row) => {
      const place = placeOf(row);

      return (
        (!byTime(sort) || place.at !== null) &&
        (after === undefined || before(sort, after, place)) &&
        (end === undefined || before(sort, place, end))
      );
    });

  return [
    ...posts.map((post): PostsRow => ({ _tag: "post", post })),
    ...between,
  ].toSorted((left, right) =>
    before(sort, placeOf(left), placeOf(right)) ? -1 : 1
  );
};
