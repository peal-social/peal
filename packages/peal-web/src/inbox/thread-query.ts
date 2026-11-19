import type { ThreadFilter } from "#inbox/atoms.ts";

// What the inbox shows, kept in the page's address (DESIGN.md, "Filters
// and display"): its view, every thread or those waiting for an answer
// (`?view=unanswered`), and the one channel it is narrowed to
// (`?channel=<id>`), so a reload, the back button or a link shows the
// same list.

/** Every thread, of every channel. */
export const everyThread: ThreadFilter = { channelId: null, unanswered: false };

/** What the address holds, as `URLSearchParams` reads it. */
interface QueryString {
  readonly get: (name: string) => string | null;
}

/** The threads an address names; a view it does not know is every thread. */
export const threadFilterOf = (query: QueryString): ThreadFilter => {
  const channel = query.get("channel")?.trim() ?? "";

  return {
    channelId: channel === "" ? null : channel,
    unanswered: query.get("view") === "unanswered",
  };
};

/** The address's query for some threads, the defaults left out. */
export const threadQueryOf = (filter: ThreadFilter): string =>
  new URLSearchParams([
    ...(filter.unanswered ? [["view", "unanswered"]] : []),
    ...(filter.channelId === null ? [] : [["channel", filter.channelId]]),
  ]).toString();

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
