import { Option, Schema } from "effect";

/**
 * How the posts page shows the posts: a list, or a calendar of when they
 * go out (DESIGN.md, "Lists: filters and display"), chosen in Display.
 */
export const PostsLayoutSchema = Schema.Literals(["list", "calendar"]);

export type PostsLayout = typeof PostsLayoutSchema.Type;

/** What the address holds, as `URLSearchParams` reads it. */
interface QueryString {
  readonly get: (name: string) => string | null;
}

const decodeLayout = Schema.decodeUnknownOption(PostsLayoutSchema);

/** The layout an address names: the list, unless it names the calendar. */
export const layoutOf = (query: QueryString): PostsLayout =>
  Option.getOrElse(decodeLayout(query.get("layout")), () => "list" as const);

// The filters both layouts read, under the same names: the calendar takes
// several ids each, comma-separated, the list one; the type is one in
// both.
const sharedFilters = ["type", "channel", "tag", "queue"] as const;

const keptValue = (
  value: string | null,
  layout: PostsLayout
): string | undefined => {
  if (value === null) {
    return undefined;
  }

  const kept = layout === "list" ? value.split(",")[0] : value;

  return kept === "" ? undefined : kept;
};

/**
 * The posts page's query in `layout`, from the address of the layout it
 * shows: the filters both read carried over (the list keeps the first of
 * several), what only the other layout reads left behind.
 */
export const layoutQuery = (query: QueryString, layout: PostsLayout): string =>
  new URLSearchParams([
    ...(layout === "list" ? [] : [["layout", layout]]),
    ...sharedFilters.flatMap((name) => {
      const kept = keptValue(query.get(name), layout);

      return kept === undefined ? [] : [[name, kept]];
    }),
  ]).toString();

/**
 * The calendar's query (`calendarQueryOf`) on the posts page: its own,
 * behind its layout.
 */
export const calendarLayoutQuery = (written: string): string =>
  written === "" ? "layout=calendar" : `layout=calendar&${written}`;
