// A sign-in whose person this page does not know yet (a provider's, which
// leaves for the provider first; one during an OAuth authorization, which
// Better Auth's client sends on; the emailed link's) leaves a mark in the
// tab's `sessionStorage`, which lasts across the provider's pages. The
// next page rendered for a signed-in person (`TabPerson`) takes it, once,
// and tells the browser's other tabs who signed in. A sign-in that was
// abandoned or refused tells nothing: its mark stays until a page of the
// tab shows a signed-in person, whose news is then true.

/** Where the tab keeps the mark across the provider's pages. */
export const signInArrivalKey = "peal.sign-in-arrival";

type TabStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/** Marks the tab: a sign-in is on its way. */
export const expectSignIn = (storage: TabStorage): void => {
  try {
    storage.setItem(signInArrivalKey, "expected");
  } catch {
    // Storage is closed to the page: the other tabs are not told.
  }
};

/** Drops the mark: the sign-in was refused before it left. */
export const forgetSignIn = (storage: TabStorage): void => {
  try {
    storage.removeItem(signInArrivalKey);
  } catch {
    // Storage is closed to the page: nothing was kept.
  }
};

/** Whether a sign-in was on its way, once: taking the mark forgets it. */
export const takeSignIn = (storage: TabStorage): boolean => {
  try {
    if (storage.getItem(signInArrivalKey) === null) {
      return false;
    }

    storage.removeItem(signInArrivalKey);

    return true;
  } catch {
    // Storage is closed to the page: nothing was kept.
    return false;
  }
};
