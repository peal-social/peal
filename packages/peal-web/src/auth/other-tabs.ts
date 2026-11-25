import { Option } from "effect";

import { personOfNews, sessionNewsOf } from "#auth/session-news.ts";

// How a tab answers the browser's other tabs (`#auth/session-news.ts`),
// and a page the back-forward cache restores: by who is signed in now
// against the person its pages were rendered for (`#auth/tab-person.ts`),
// never by the news alone. A tab whose person did not change keeps
// everything it holds, a post or an article being written included (its
// own requests carry the renewed session's cookie as they are); one whose
// person changed loads anew, which forgets what it held for them.
// `OtherTabsSession` listens in every page.

/**
 * What a tab does: stays as it is, loads its own address again (the
 * server then sends a signed-out tab to sign in), or loads the app's
 * home anew (`/`, which opens what the new person's session leads to).
 */
export type TabAnswer = "openHome" | "reloadHere" | "stay";

/**
 * Whether a page keeps its own address when its person changes: the sign-in
 * and sign-up pages, and those that hold an authorization in progress (the
 * OAuth pages, the device page with its typed code), which `/` would lose.
 */
export const keepsItsPlace = (pathname: string): boolean =>
  /^\/(?:device|login|oauth|signup)(?:[/?#]|$)/u.test(pathname);

/** What a tab does, from who is signed in now and who its pages showed. */
export const tabAnswer = ({
  keepsPlace,
  now,
  shown,
}: {
  /** The page keeps its address (`keepsItsPlace`). */
  readonly keepsPlace: boolean;
  /** Who is signed in now: none once signed out. */
  readonly now: Option.Option<string>;
  /** Whom the tab's pages showed: none on a page nobody was signed in to. */
  readonly shown: Option.Option<string>;
}): TabAnswer => {
  // A page nobody was signed in to holds nobody's work: a sign-in
  // elsewhere leaves it be.
  if (Option.isNone(shown)) {
    return "stay";
  }

  // The same person, back after their session ended: their work stays.
  if (Option.isSome(now) && now.value === shown.value) {
    return "stay";
  }

  return Option.isNone(now) || keepsPlace ? "reloadHere" : "openHome";
};

/** What a tab does, for the page's state and what it may do. */
export interface TabSide {
  /** Loads the app's home anew. */
  readonly openHome: () => void;
  /** The page's path, without its language (`/oauth/consent`). */
  readonly pathname: () => string;
  /** Loads the page's own address again. */
  readonly reloadHere: () => void;
  /** Marks the tab as leaving, before it loads anew. */
  readonly markLeaving: () => void;
  /** Whom the tab's pages showed. */
  readonly shown: () => Option.Option<string>;
}

const answer = (tab: TabSide, now: Option.Option<string>): TabAnswer => {
  const chosen = tabAnswer({
    keepsPlace: keepsItsPlace(tab.pathname()),
    now,
    shown: tab.shown(),
  });

  if (chosen !== "stay") {
    tab.markLeaving();
  }

  if (chosen === "reloadHere") {
    tab.reloadHere();
  }

  if (chosen === "openHome") {
    tab.openHome();
  }

  return chosen;
};

/**
 * Answers a storage event: another tab's news of the session, or nothing
 * for any other change.
 */
export const heardOtherTab = (
  tab: TabSide,
  change: { readonly key: string | null; readonly newValue: string | null }
): TabAnswer =>
  Option.match(sessionNewsOf(change), {
    onNone: (): TabAnswer => "stay",
    onSome: (news) => answer(tab, personOfNews(news)),
  });

/**
 * Answers a page the back-forward cache restored, which heard nothing
 * while it was kept: a tab that showed a person reads who is signed in
 * now (`signedIn`), only then. Nothing changes when that read fails.
 */
export const restoredPage = async (
  tab: TabSide,
  signedIn: () => Promise<Option.Option<string>>
): Promise<TabAnswer> => {
  if (Option.isNone(tab.shown())) {
    return "stay";
  }

  try {
    return answer(tab, await signedIn());
  } catch {
    // The server could not tell: the page stays as it is.
    return "stay";
  }
};
