import { Option, Schema } from "effect";
import { maxMediaQueryLength, MediaKindSchema } from "peal-contract";
import type { MediaKind } from "peal-contract";

/** What the library is narrowed to: text in a name or description, a kind. */
export interface LibrarySearch {
  readonly kind: MediaKind | null;
  /** As the person typed it. */
  readonly text: string;
}

/** The whole library. */
export const everything: LibrarySearch = { kind: null, text: "" };

/** How long the search waits after the last key before it asks the API. */
export const searchDelayMs = 300;

// The text the API takes: composed (NFC, as the server keeps names),
// trimmed, and no longer than it searches, cut between characters, never
// inside one.
const textOf = (text: string): string => {
  const trimmed = text.toWellFormed().normalize("NFC").trim();
  const characters = trimmed.match(/./gsu) ?? [];
  let kept = "";

  for (const character of characters) {
    if (kept.length + character.length > maxMediaQueryLength) {
      break;
    }

    kept += character;
  }

  return kept;
};

/** Whether a text or a kind narrows the library. */
export const isNarrowed = (search: LibrarySearch): boolean =>
  search.kind !== null || textOf(search.text) !== "";

/** What the media list asks for one page of a search. */
export interface LibraryQuery {
  cursor?: string;
  kind?: MediaKind;
  q?: string;
}

/** The query of a page of the library, narrowed as the search says. */
export const queryOf = (
  search: LibrarySearch,
  cursor: Option.Option<string>
): LibraryQuery => {
  const query: LibraryQuery = {};
  const text = textOf(search.text);

  if (Option.isSome(cursor)) {
    query.cursor = cursor.value;
  }

  if (search.kind !== null) {
    query.kind = search.kind;
  }

  if (text !== "") {
    query.q = text;
  }

  return query;
};

const PageKeySchema = Schema.fromJsonString(
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    kind: Schema.NullOr(MediaKindSchema),
    text: Schema.String,
    workspaceId: Schema.String,
  })
);

const encodeKey = Schema.encodeSync(PageKeySchema);

const decodeKey = Schema.decodeUnknownSync(PageKeySchema);

/** The page of a search, written as one string, which atoms are keyed by. */
export const pageKeyOf = (
  workspaceId: string,
  search: LibrarySearch,
  cursor: Option.Option<string>
): string =>
  encodeKey({
    cursor: Option.getOrNull(cursor),
    kind: search.kind,
    text: textOf(search.text),
    workspaceId,
  });

/** The page a key names. */
export const pageOfKey = (key: string) => {
  const { cursor, kind, text, workspaceId } = decodeKey(key);

  return {
    cursor: Option.fromNullOr(cursor),
    search: { kind, text } satisfies LibrarySearch,
    workspaceId,
  };
};

/** What the address holds, as `URLSearchParams` reads it. */
interface QueryString {
  readonly get: (name: string) => string | null;
}

const decodeKind = Schema.decodeUnknownOption(MediaKindSchema);

/**
 * The search an address names (DESIGN.md, "Filters and display"): `q`,
 * as typed, and `kind`, left out when it is no kind.
 */
export const librarySearchOf = (query: QueryString): LibrarySearch => ({
  kind: Option.getOrNull(decodeKind(query.get("kind"))),
  text: query.get("q") ?? "",
});

/** The address's query for a search, without what is left empty. */
export const libraryQueryStringOf = (search: LibrarySearch): string =>
  new URLSearchParams([
    ...(textOf(search.text) === "" ? [] : [["q", search.text]]),
    ...(search.kind === null ? [] : [["kind", search.kind]]),
  ]).toString();
