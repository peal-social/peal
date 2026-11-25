import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import {
  personOfNews,
  sessionNewsKey,
  sessionNewsOf,
  tellOtherTabs,
} from "#auth/session-news.ts";

// A tab's `localStorage`, which writes down what is done to it and what
// it holds, as the browser tells the other tabs of each change.
const recordedStorage = () => {
  const items = new Map<string, string>();
  const changes: { key: string; newValue: string | null }[] = [];

  return {
    changes,
    items,
    storage: {
      removeItem: (key: string) => {
        items.delete(key);
        changes.push({ key, newValue: null });
      },
      setItem: (key: string, value: string) => {
        items.set(key, value);
        changes.push({ key, newValue: value });
      },
    },
  };
};

// Storage closed to the page, as a private window may have it.
const closedStorage = {
  removeItem: () => {
    throw new Error("synthetic closed storage");
  },
  setItem: () => {
    throw new Error("synthetic closed storage");
  },
};

describe("the news of a session, from one tab to the others", () => {
  it("reaches the other tabs as the person signs out, and stays nowhere", () => {
    const { changes, items, storage } = recordedStorage();

    tellOtherTabs({ kind: "signedOut" }, Option.some(storage));

    // What the other tabs hear: the news, then its removal, which says
    // nothing.
    expect(changes.map((change) => sessionNewsOf(change))).toStrictEqual([
      Option.some({ kind: "signedOut" }),
      Option.none(),
    ]);
    expect(items.size).toBe(0);
  });

  it("reaches them as someone signs in, and says who", () => {
    const { changes, storage } = recordedStorage();

    tellOtherTabs(
      { kind: "signedIn", userId: "user_synthetic_ada" },
      Option.some(storage)
    );

    expect(changes.map((change) => sessionNewsOf(change))[0]).toStrictEqual(
      Option.some({ kind: "signedIn", userId: "user_synthetic_ada" })
    );
  });

  it("names who is signed in now, nobody once signed out", () => {
    expect(
      personOfNews({ kind: "signedIn", userId: "user_synthetic_ada" })
    ).toStrictEqual(Option.some("user_synthetic_ada"));
    expect(personOfNews({ kind: "signedOut" })).toStrictEqual(Option.none());
  });

  it("is nothing for another key, or for what is not news", () => {
    expect(
      sessionNewsOf({
        key: "peal.measurement-news",
        newValue: JSON.stringify({ kind: "signedOut" }),
      })
    ).toStrictEqual(Option.none());
    expect(
      sessionNewsOf({
        key: sessionNewsKey,
        newValue: JSON.stringify({ kind: "synthetic-unknown-news" }),
      })
    ).toStrictEqual(Option.none());
    // An older page's sign-in, which named nobody.
    expect(
      sessionNewsOf({
        key: sessionNewsKey,
        newValue: JSON.stringify({ kind: "signedIn" }),
      })
    ).toStrictEqual(Option.none());
    expect(
      sessionNewsOf({ key: sessionNewsKey, newValue: "not news" })
    ).toStrictEqual(Option.none());
    // Another tab cleared the whole storage.
    expect(sessionNewsOf({ key: null, newValue: null })).toStrictEqual(
      Option.none()
    );
  });

  it("tells nothing, and breaks nothing, where storage is closed", () => {
    expect(() => {
      tellOtherTabs({ kind: "signedOut" }, Option.some(closedStorage));
      tellOtherTabs({ kind: "signedOut" }, Option.none());
    }).not.toThrow();
  });
});
