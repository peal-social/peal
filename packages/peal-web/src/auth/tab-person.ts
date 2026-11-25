import { Option } from "effect";

// Who this tab's pages were rendered for, and whether it is on its way
// out. A page that knows the signed-in person (the signed-in app's
// layout, the OAuth and device pages) names them (`TabPerson`); what the
// tab holds in memory belongs to that person until the page loads anew,
// which forgets both. A tab that never showed a signed-in person's page
// has none. Read by the answer to the other tabs' news
// (`#auth/other-tabs.ts`), which marks the tab as leaving before it loads
// the app anew, so nothing more is kept for the person it showed (the
// Studio's draft as the page goes, `pagehide`).

/** What the tab knows of itself, until the page loads anew. */
interface TabState {
  leaving: boolean;
  person: Option.Option<string>;
}

const thisTab: TabState = { leaving: false, person: Option.none() };

/** The person this tab's pages were rendered for, if any. */
export const tabPerson = (): Option.Option<string> => thisTab.person;

/** A page of this tab was rendered for the person. */
export const showPerson = (userId: string): void => {
  thisTab.person = Option.some(userId);
};

/** The tab loads the app anew: nothing more is kept as it goes. */
export const markLeaving = (): void => {
  thisTab.leaving = true;
};

/** Whether the tab is loading the app anew, after another tab's news. */
export const isLeaving = (): boolean => thisTab.leaving;
