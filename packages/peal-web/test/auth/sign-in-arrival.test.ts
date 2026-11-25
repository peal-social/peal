import { describe, expect, it } from "@effect/vitest";

import {
  expectSignIn,
  forgetSignIn,
  signInArrivalKey,
  takeSignIn,
} from "#auth/sign-in-arrival.ts";

// A tab's `sessionStorage`.
const tabStorage = () => {
  const items = new Map<string, string>();

  return {
    items,
    storage: {
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => {
        items.delete(key);
      },
      setItem: (key: string, value: string) => {
        items.set(key, value);
      },
    },
  };
};

// Storage closed to the page, as a private window may have it.
const closedStorage = {
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

describe("a sign-in on its way, across the provider's pages", () => {
  it("arrives once", () => {
    const { items, storage } = tabStorage();

    expectSignIn(storage);

    expect(items.has(signInArrivalKey)).toBeTruthy();
    expect(takeSignIn(storage)).toBeTruthy();
    expect(takeSignIn(storage)).toBeFalsy();
    expect(items.size).toBe(0);
  });

  it("never arrives when none left", () => {
    expect(takeSignIn(tabStorage().storage)).toBeFalsy();
  });

  it("is dropped when the provider's sign-in is refused before it leaves", () => {
    const { storage } = tabStorage();

    expectSignIn(storage);
    forgetSignIn(storage);

    expect(takeSignIn(storage)).toBeFalsy();
  });

  it("breaks nothing where storage is closed", () => {
    expect(() => {
      expectSignIn(closedStorage);
      forgetSignIn(closedStorage);
    }).not.toThrow();
    expect(takeSignIn(closedStorage)).toBeFalsy();
  });
});
