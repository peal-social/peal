import { Option, Schema } from "effect";

// A sign-out loads the next page anew, which ends the toasts of the page
// it leaves: what that next page must say is kept in the tab's
// `sessionStorage` across the load, and said once there
// (`SignedOutNoticeToast`). It names a message, never holds one.

/** Where the tab keeps the notice across the load. */
export const signedOutNoticeKey = "peal.signed-out-notice";

export const SignedOutNoticeSchema = Schema.Literals(["accountDeleted"]);

/** What the page after a sign-out says: the account is deleted. */
export type SignedOutNotice = typeof SignedOutNoticeSchema.Type;

const decodeNotice = Schema.decodeUnknownOption(SignedOutNoticeSchema);

type TabStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

/** The tab's `sessionStorage`, or none where the browser refuses it. */
export const tabStorage = (): Option.Option<TabStorage> => {
  try {
    // A closing tab (one refused `close()`) may answer none.
    return Option.fromNullOr(globalThis.sessionStorage);
  } catch {
    // Storage the browser refuses (some private modes) keeps nothing.
    return Option.none();
  }
};

/** Keeps the notice for the next page, when the browser lets it. */
export const keepSignedOutNotice = (
  storage: TabStorage,
  notice: SignedOutNotice
): void => {
  try {
    storage.setItem(signedOutNoticeKey, notice);
  } catch {
    // Storage is closed to the page: the next one says nothing.
  }
};

/** The notice the last page kept, once: taking it forgets it. */
export const takeSignedOutNotice = (
  storage: TabStorage
): Option.Option<SignedOutNotice> => {
  try {
    const kept = storage.getItem(signedOutNoticeKey);

    if (kept === null) {
      return Option.none();
    }

    storage.removeItem(signedOutNoticeKey);

    return decodeNotice(kept);
  } catch {
    // Storage is closed to the page: nothing was kept.
    return Option.none();
  }
};
