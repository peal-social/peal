import { Option, Schema } from "effect";

// A tab that signs out, or signs someone in, tells the browser's other
// tabs of the app who is signed in now. A tab keeps the agent's chats and
// drafts in memory as long as it lives, so one left open would show the
// last person's to the next one: a tab whose person changed loads the app
// anew, and one whose person did not keeps what it holds, unsaved text
// included (`#auth/other-tabs.ts`). This is the app's own news, whether
// or not the measurement runs (which tells the tabs its own,
// `#measurement/tabs.ts`). It travels as a storage event: written to
// `localStorage`, then removed at once, so nothing stays, the browser
// tells every other tab of the origin, and never the tab that wrote it.

/** The storage key a tab writes its news of the session to. */
export const sessionNewsKey = "peal.session-news";

/**
 * What one tab tells the others: someone signed in, and who (staff
 * starting or stopping acting as someone included, as the person they
 * now are), or the person signed out.
 */
export const SessionNewsSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("signedIn"), userId: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("signedOut") }),
]);

export type SessionNews = typeof SessionNewsSchema.Type;

const decodeNews = Schema.decodeUnknownOption(
  Schema.fromJsonString(SessionNewsSchema)
);

type NewsStorage = Pick<Storage, "removeItem" | "setItem">;

// The page's `localStorage`, or none where the browser refuses it.
const pageStorage = (): Option.Option<NewsStorage> => {
  try {
    return Option.fromNullOr(globalThis.localStorage);
  } catch {
    // Storage the browser refuses (some private modes) carries nothing.
    return Option.none();
  }
};

/**
 * Tells the browser's other tabs of the app: written, then removed at
 * once. A browser that refuses storage tells nothing, and the other tabs
 * follow once they are loaded again.
 */
export const tellOtherTabs = (
  news: SessionNews,
  storage: Option.Option<NewsStorage> = pageStorage()
): void => {
  for (const kept of Option.toArray(storage)) {
    try {
      kept.setItem(sessionNewsKey, JSON.stringify(news));
      kept.removeItem(sessionNewsKey);
    } catch {
      // Storage is closed to the page, or full: nothing told.
    }
  }
};

/** What a storage event says of the session, none for anything else. */
export const sessionNewsOf = (change: {
  readonly key: string | null;
  readonly newValue: string | null;
}): Option.Option<SessionNews> =>
  change.key === sessionNewsKey ? decodeNews(change.newValue) : Option.none();

/** Who the news says is signed in now: none once signed out. */
export const personOfNews = (news: SessionNews): Option.Option<string> =>
  news.kind === "signedIn" ? Option.some(news.userId) : Option.none();
