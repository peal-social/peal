import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import {
  keepSignedOutNotice,
  signedOutNoticeKey,
  takeSignedOutNotice,
} from "#auth/signed-out-notice.ts";

// A tab's storage in memory, as `sessionStorage` behaves.
const memoryStorage = (): Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
> => {
  const items = new Map<string, string>();

  return {
    getItem: (key) => items.get(key) ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
};

// Storage closed to the page, as a private window may have it.
const closedStorage: Pick<Storage, "getItem" | "removeItem" | "setItem"> = {
  getItem: () => {
    throw new Error("synthetic closed storage");
  },
  removeItem: () => {
    throw new Error("synthetic closed storage");
  },
  setItem: () => {
    throw new Error("synthetic closed storage");
  },
};

describe("what the page after a sign-out says", () => {
  it("is said once, on the next page", () => {
    const storage = memoryStorage();

    keepSignedOutNotice(storage, "accountDeleted");

    expect(takeSignedOutNotice(storage)).toStrictEqual(
      Option.some("accountDeleted")
    );
    expect(takeSignedOutNotice(storage)).toStrictEqual(Option.none());
  });

  it("is nothing when the tab kept none, or something else", () => {
    const storage = memoryStorage();

    expect(takeSignedOutNotice(storage)).toStrictEqual(Option.none());

    storage.setItem(signedOutNoticeKey, "synthetic-unknown-notice");

    expect(takeSignedOutNotice(storage)).toStrictEqual(Option.none());
    expect(storage.getItem(signedOutNoticeKey)).toBeNull();
  });

  it("is nothing, and breaks nothing, where storage is closed", () => {
    keepSignedOutNotice(closedStorage, "accountDeleted");

    expect(takeSignedOutNotice(closedStorage)).toStrictEqual(Option.none());
  });
});
