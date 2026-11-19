import { Option, Schema } from "effect";
import {
  PostOutcomeSchema,
  PostSortSchema,
  PostStatusSchema,
} from "peal-contract";
import type { PostOutcome, PostSort, PostStatus } from "peal-contract";

/**
 * What the posts list shows, kept in the page's query string so a link
 * shows the same list. An outcome is a filter on finished posts only.
 */
export interface PostListFilters {
  readonly channelId?: string;
  readonly outcome?: PostOutcome;
  readonly queueId?: string;
  readonly sort: PostSort;
  readonly status?: PostStatus;
  readonly tagId?: string;
}

/** Every post, newest first. */
export const noFilters: PostListFilters = { sort: "createdDesc" };

/** What the query string holds, as `URLSearchParams` reads it. */
interface QueryString {
  readonly get: (name: string) => string | null;
}

const read = <A>(
  schema: Schema.Codec<A, string>,
  value: string | null
): Option.Option<A> =>
  value === null || value === ""
    ? Option.none()
    : Schema.decodeUnknownOption(schema)(value);

type Writable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * The filters a query string names. A value it does not know, as a link
 * written by hand may hold, is ignored, and so is an outcome without the
 * finished status.
 */
export const filtersOf = (query: QueryString): PostListFilters => {
  const status = read(PostStatusSchema, query.get("status"));
  const outcome = read(PostOutcomeSchema, query.get("outcome"));
  const channelId = read(Schema.String, query.get("channel"));
  const tagId = read(Schema.String, query.get("tag"));
  const queueId = read(Schema.String, query.get("queue"));

  const filters: Writable<PostListFilters> = {
    sort: Option.getOrElse(
      read(PostSortSchema, query.get("sort")),
      () => noFilters.sort
    ),
  };

  if (Option.isSome(status)) {
    filters.status = status.value;
  }

  if (Option.isSome(outcome) && filters.status === "finished") {
    filters.outcome = outcome.value;
  }

  if (Option.isSome(channelId)) {
    filters.channelId = channelId.value;
  }

  if (Option.isSome(tagId)) {
    filters.tagId = tagId.value;
  }

  if (Option.isSome(queueId)) {
    filters.queueId = queueId.value;
  }

  return filters;
};

/** The query string of the filters, without the defaults. */
export const queryOf = (filters: PostListFilters): string =>
  new URLSearchParams([
    ...(filters.status === undefined ? [] : [["status", filters.status]]),
    ...(filters.outcome === undefined ? [] : [["outcome", filters.outcome]]),
    ...(filters.channelId === undefined
      ? []
      : [["channel", filters.channelId]]),
    ...(filters.tagId === undefined ? [] : [["tag", filters.tagId]]),
    ...(filters.queueId === undefined ? [] : [["queue", filters.queueId]]),
    ...(filters.sort === noFilters.sort ? [] : [["sort", filters.sort]]),
  ]).toString();

/**
 * What `posts.search` is asked for one page: the filters, and the cursor
 * the page before gave, which holds only with the same filters and sort.
 */
export const searchOf = (
  filters: PostListFilters,
  cursor: string | undefined
): PostListFilters & { readonly cursor?: string } => {
  if (cursor === undefined) {
    return filters;
  }

  return { ...filters, cursor };
};

/** Whether the sort lists only posts with a time. */
export const byTime = (sort: PostSort): boolean =>
  sort === "scheduledAsc" || sort === "scheduledDesc";

/**
 * Whether the filters narrow the list: a filter, or an order by time,
 * which leaves out the posts without one.
 */
export const isFiltering = (filters: PostListFilters): boolean =>
  filters.status !== undefined ||
  filters.channelId !== undefined ||
  filters.tagId !== undefined ||
  filters.queueId !== undefined ||
  byTime(filters.sort);

/** A filter of the query string, by its name there. */
export type FilterName =
  | "channel"
  | "outcome"
  | "queue"
  | "sort"
  | "status"
  | "tag";

/** What the posts list can be ordered by, in the Display panel. */
export type PostOrdering = "created" | "scheduled";

/** A sort as the Display panel shows it: what it orders by, which way. */
export interface Ordering {
  readonly field: PostOrdering;
  readonly direction: "asc" | "desc";
}

export const orderingOf = (sort: PostSort): Ordering => ({
  direction: sort === "createdAsc" || sort === "scheduledAsc" ? "asc" : "desc",
  field: byTime(sort) ? "scheduled" : "created",
});

/** The sort the Display panel's ordering and direction make. */
export const sortOf = (
  field: PostOrdering,
  direction: "asc" | "desc"
): PostSort => {
  if (field === "scheduled") {
    return direction === "asc" ? "scheduledAsc" : "scheduledDesc";
  }

  return direction === "asc" ? "createdAsc" : "createdDesc";
};

/**
 * The filters with one changed, or taken off with `undefined`: read back
 * from the query string, so a value the list does not know is dropped, and
 * so is an outcome once the status is not "finished".
 */
export const withFilter = (
  filters: PostListFilters,
  name: FilterName,
  value: string | undefined
): PostListFilters => {
  const query = new URLSearchParams(queryOf(filters));

  if (value === undefined) {
    query.delete(name);
  } else {
    query.set(name, value);
  }

  return filtersOf(query);
};

/**
 * The posts list's views, its tabs (DESIGN.md, "Filters and display"): all
 * of them, then the states people open most, each a status.
 */
export const postViews = [
  { status: undefined, view: "all" },
  { status: "draft", view: "drafts" },
  { status: "scheduled", view: "scheduled" },
  { status: "awaitingApproval", view: "approval" },
] as const satisfies readonly {
  readonly status: PostStatus | undefined;
  readonly view: string;
}[];

/** Whether a tab shows the list's status, so no chip repeats it. */
export const isViewStatus = (status: PostStatus | undefined): boolean =>
  postViews.some((view) => view.status === status && status !== undefined);

/**
 * Whether the filters narrow the list beyond its tab: a status a tab
 * shows is the view, not a filter.
 */
export const isFilteringView = (filters: PostListFilters): boolean => {
  const { status, ...rest } = filters;

  return isFiltering(isViewStatus(status) ? rest : filters);
};
