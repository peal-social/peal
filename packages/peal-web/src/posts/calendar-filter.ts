import type { Post } from "peal-contract";

import type { PostsType } from "#posts/articles-among-posts.ts";

// What the calendar shows of the posts and articles it loaded, once the
// viewer chose a type, tags, channels or queues. Filtering happens in the
// browser: nothing is asked of the server again.

/**
 * The type, tags, channels and queues the viewer chose; none of a kind is
 * all of it.
 */
export interface CalendarFilter {
  readonly channelIds: readonly string[];
  readonly queueIds: readonly string[];
  readonly tagIds: readonly string[];
  /** Posts or articles alone; both when left out. */
  readonly type?: PostsType;
}

export const noFilter: CalendarFilter = {
  channelIds: [],
  queueIds: [],
  tagIds: [],
};

/** Whether the viewer chose anything. */
export const isFiltering = ({
  channelIds,
  queueIds,
  tagIds,
  type,
}: CalendarFilter): boolean =>
  channelIds.length > 0 ||
  queueIds.length > 0 ||
  tagIds.length > 0 ||
  type !== undefined;

/**
 * Whether articles show: unless the viewer keeps posts alone, or chose a
 * channel, a tag or a queue, which articles have none of.
 */
export const showsArticles = (filter: CalendarFilter): boolean =>
  filter.type !== "post" &&
  filter.channelIds.length === 0 &&
  filter.queueIds.length === 0 &&
  filter.tagIds.length === 0;

/**
 * What the filter reads of a post: its tags, the channels it goes to and
 * the queue that placed it.
 */
interface Filtered {
  readonly queueId: Post["queueId"];
  readonly tagIds: Post["tagIds"];
  readonly targets: readonly Pick<
    Post["targets"][number],
    "channelId" | "dropped"
  >[];
}

/**
 * Whether a post shows: posts are not left out for articles, and it has
 * one of the chosen tags, when some are chosen, goes to one of the chosen
 * channels, when some are, and was placed by one of the chosen queues,
 * when some are.
 */
export const matchesFilter = (
  { channelIds, queueIds, tagIds, type }: CalendarFilter,
  post: Filtered
): boolean =>
  type !== "article" &&
  (tagIds.length === 0 || post.tagIds.some((id) => tagIds.includes(id))) &&
  (channelIds.length === 0 ||
    post.targets.some(
      ({ channelId, dropped }) =>
        dropped !== true && channelIds.includes(channelId)
    )) &&
  (queueIds.length === 0 ||
    (post.queueId !== null && queueIds.includes(post.queueId)));

/** What shows of some posts, and how many of them the filter hides. */
export const filtered = <Item extends { readonly post: Filtered }>(
  filter: CalendarFilter,
  items: readonly Item[]
) => {
  const shown = items.filter(({ post }) => matchesFilter(filter, post));

  return { hidden: items.length - shown.length, shown };
};

/** The ids with one chosen or not, each once. */
export const withChoice = (
  ids: readonly string[],
  id: string,
  chosen: boolean
): readonly string[] => {
  const others = ids.filter((other) => other !== id);

  return chosen ? [...others, id] : others;
};

/**
 * The filter without the tags, channels and queues the workspace no
 * longer has:
 * one deleted or disconnected since it was chosen would hide every post,
 * with nothing left to untick.
 */
export const knownFilter = (
  filter: CalendarFilter,
  known: {
    readonly channelIds: readonly string[];
    readonly queueIds: readonly string[];
    readonly tagIds: readonly string[];
  }
): CalendarFilter => ({
  ...filter,
  channelIds: filter.channelIds.filter((id) => known.channelIds.includes(id)),
  queueIds: filter.queueIds.filter((id) => known.queueIds.includes(id)),
  tagIds: filter.tagIds.filter((id) => known.tagIds.includes(id)),
});
