import { Option, Schema } from "effect";

// A tab that signs out, or signs someone in, tells the browser's other
// tabs of the app, which then load the app anew (`OtherTabsSession`): a
// tab keeps the agent's chats and drafts in memory as long as it lives,
// so a tab left open would show the last person's to the next one. This
// is the app's own news, whether or not the measurement runs (which
// tells the tabs its own, `#measurement/tabs.ts`). It travels as a
// storage event: written to `localStorage`, then removed at once, so
// nothing stays, the browser tells every other tab of the origin, and
// never the tab that wrote it.

/** The storage key a tab writes its news of the session to. */
export const sessionNewsKey = "peal.session-news";

/**
 * What one tab tells the others: the person signed out, or someone
 * signed in (staff starting or stopping acting as someone included).
 */
export const SessionNewsSchema = Schema.Struct({
  kind: Schema.Literals(["signedIn", "signedOut"]),
});

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
