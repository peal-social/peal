import type { ThreadFilter } from "#inbox/atoms.ts";

// What the inbox's list shows, kept in the address (DESIGN.md, "Filters
// and display"), on the inbox and on every item it opens: the tab
// (comments, reviews or messages: `?view=`), and the comments' filters,
// those waiting for an answer (`?status=waiting`) and one channel
// (`?channel=<id>`). A row's link carries it, so the list stays as it was
// beside the item it opened.

/** The inbox's tabs. */
export type InboxView = "comments" | "messages" | "reviews";

export const inboxViews: readonly InboxView[] = [
  "comments",
  "reviews",
  "messages",
];

/** What the list shows: a tab, and the comments' filters. */
export interface InboxState {
  readonly view: InboxView;
  readonly filter: ThreadFilter;
}

/** Every comment, of every channel. */
export const everyThread: ThreadFilter = { channelId: null, unanswered: false };

export const defaultInbox: InboxState = {
  filter: everyThread,
  view: "comments",
};

/** What the address holds, as `URLSearchParams` reads it. */
interface QueryString {
  readonly get: (name: string) => string | null;
}

/** The list an address names; what it does not know is the default. */
export const inboxStateOf = (query: QueryString): InboxState => {
  const channel = query.get("channel")?.trim() ?? "";
  const view = inboxViews.find((each) => each === query.get("view"));

  return {
    filter: {
      channelId: channel === "" ? null : channel,
      unanswered: query.get("status") === "waiting",
    },
    view: view ?? "comments",
  };
};

/** The address's query for a list, the defaults left out. */
export const inboxQueryOf = ({ filter, view }: InboxState): string =>
  new URLSearchParams([
    ...(view === "comments" ? [] : [["view", view]]),
    ...(filter.unanswered ? [["status", "waiting"]] : []),
    ...(filter.channelId === null ? [] : [["channel", filter.channelId]]),
  ]).toString();

/**
 * A path with a list's query, when it has one, and the item's own after
 * it (`more`: a conversation's `cursor`), so a link inside an item keeps
 * the list as it was.
 */
export const withInboxQuery = (
  path: string,
  state: InboxState,
  more: Readonly<Record<string, string>> = {}
): string => {
  const query = new URLSearchParams([
    ...new URLSearchParams(inboxQueryOf(state)),
    ...Object.entries(more),
  ]).toString();

  return query === "" ? path : `${path}?${query}`;
};

/**
 * The filter without a channel the inbox does not read (deleted,
 * disconnected or on a platform without comments): one such would show
 * nothing, with nothing left to take off.
 */
export const knownThreadFilter = (
  filter: ThreadFilter,
  readable: readonly string[]
): ThreadFilter =>
  filter.channelId === null || readable.includes(filter.channelId)
    ? filter
    : { ...filter, channelId: null };
