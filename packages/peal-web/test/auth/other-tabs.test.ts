import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import {
  heardOtherTab,
  keepsItsPlace,
  restoredPage,
  tabAnswer,
} from "#auth/other-tabs.ts";
import type { TabSide } from "#auth/other-tabs.ts";
import { sessionNewsKey, tellOtherTabs } from "#auth/session-news.ts";

const ada = "user_synthetic_ada";
const bob = "user_synthetic_bob";

// A tab whose pages showed `shown` at `pathname`, which writes down what
// it does.
const tabAt = (pathname: string, shown: Option.Option<string>) => {
  const did: string[] = [];

  const side: TabSide = {
    markLeaving: () => {
      did.push("markLeaving");
    },
    openHome: () => {
      did.push("openHome");
    },
    pathname: () => pathname,
    reloadHere: () => {
      did.push("reloadHere");
    },
    shown: () => shown,
  };

  return { did, side };
};

// A browser of tabs sharing one `localStorage`: each change one tab makes
// reaches every other tab as a storage event, never the tab that made it.
const browserOf = (...tabs: readonly ReturnType<typeof tabAt>[]) =>
  tabs.map((writer) => ({
    ...writer,
    storage: Option.some({
      removeItem: (key: string) => {
        for (const other of tabs.filter((tab) => tab !== writer)) {
          heardOtherTab(other.side, { key, newValue: null });
        }
      },
      setItem: (key: string, value: string) => {
        for (const other of tabs.filter((tab) => tab !== writer)) {
          heardOtherTab(other.side, { key, newValue: value });
        }
      },
    }),
  }));

describe("what a tab does once the person signed in changes", () => {
  it("leaves a page nobody was signed in to as it is", () => {
    for (const now of [Option.some(ada), Option.none()]) {
      expect(tabAnswer({ keepsPlace: false, now, shown: Option.none() })).toBe(
        "stay"
      );
    }
  });

  it("keeps the same person's page, their unsaved work with it", () => {
    for (const keepsPlace of [false, true]) {
      expect(
        tabAnswer({
          keepsPlace,
          now: Option.some(ada),
          shown: Option.some(ada),
        })
      ).toBe("stay");
    }
  });

  it("opens the app's home for someone else", () => {
    expect(
      tabAnswer({
        keepsPlace: false,
        now: Option.some(bob),
        shown: Option.some(ada),
      })
    ).toBe("openHome");
  });

  it("loads the page again, there, once signed out", () => {
    expect(
      tabAnswer({
        keepsPlace: false,
        now: Option.none(),
        shown: Option.some(ada),
      })
    ).toBe("reloadHere");
  });

  it("loads a page that keeps its place again, there, for someone else", () => {
    expect(
      tabAnswer({
        keepsPlace: true,
        now: Option.some(bob),
        shown: Option.some(ada),
      })
    ).toBe("reloadHere");
    expect(
      tabAnswer({
        keepsPlace: true,
        now: Option.none(),
        shown: Option.some(ada),
      })
    ).toBe("reloadHere");
  });

  it("knows the pages that keep their place", () => {
    for (const path of [
      "/login",
      "/login?next=%2Fdevice",
      "/signup",
      "/oauth/consent",
      "/oauth/workspace",
      "/device",
    ]) {
      expect(keepsItsPlace(path)).toBeTruthy();
    }

    for (const path of ["/", "/studio/posts", "/devices", "/login-help"]) {
      expect(keepsItsPlace(path)).toBeFalsy();
    }
  });
});

describe("a tab hearing another tab's news", () => {
  it("does nothing for another key", () => {
    const tab = tabAt("/studio/posts", Option.some(ada));

    expect(
      heardOtherTab(tab.side, {
        key: "peal.measurement-news",
        newValue: JSON.stringify({ kind: "signedOut" }),
      })
    ).toBe("stay");
    expect(tab.did).toStrictEqual([]);
  });

  it("marks itself as leaving before it loads anew", () => {
    const tab = tabAt("/studio/posts", Option.some(ada));

    heardOtherTab(tab.side, {
      key: sessionNewsKey,
      newValue: JSON.stringify({ kind: "signedOut" }),
    });

    expect(tab.did).toStrictEqual(["markLeaving", "reloadHere"]);
  });
});

describe("two tabs of one browser", () => {
  it("keeps a post being written when its person signs in again elsewhere", () => {
    // Ada writes in tab A; her session ended, and she signs in in tab B.
    const [writing, signingIn] = browserOf(
      tabAt("/studio/posts", Option.some(ada)),
      tabAt("/login", Option.some(ada))
    );

    tellOtherTabs({ kind: "signedIn", userId: ada }, signingIn?.storage);

    expect(writing?.did).toStrictEqual([]);
  });

  it("opens the app's home anew for someone else signed in elsewhere", () => {
    const [adas, bobs] = browserOf(
      tabAt("/studio/posts", Option.some(ada)),
      tabAt("/login", Option.none())
    );

    tellOtherTabs({ kind: "signedIn", userId: bob }, bobs?.storage);

    expect(adas?.did).toStrictEqual(["markLeaving", "openHome"]);
  });

  it("loads the page again once its person signed out elsewhere", () => {
    const [left, signingOut] = browserOf(
      tabAt("/studio/posts", Option.some(ada)),
      tabAt("/settings/account", Option.some(ada))
    );

    tellOtherTabs({ kind: "signedOut" }, signingOut?.storage);

    expect(left?.did).toStrictEqual(["markLeaving", "reloadHere"]);
    // The tab that signed out hears nothing of its own news.
    expect(signingOut?.did).toStrictEqual([]);
  });

  it("keeps an authorization's page where it is", () => {
    const [consent, bobs] = browserOf(
      tabAt("/oauth/consent", Option.some(ada)),
      tabAt("/login", Option.none())
    );

    tellOtherTabs({ kind: "signedIn", userId: bob }, bobs?.storage);

    expect(consent?.did).toStrictEqual(["markLeaving", "reloadHere"]);
  });

  it("leaves a page nobody was signed in to as it is", () => {
    const [review, signingIn] = browserOf(
      tabAt("/review/synthetic-link", Option.none()),
      tabAt("/login", Option.none())
    );

    tellOtherTabs({ kind: "signedIn", userId: ada }, signingIn?.storage);

    expect(review?.did).toStrictEqual([]);
  });
});

// The server's answer to who is signed in now, a moment later.
const answering = (now: Option.Option<string>) => async () => {
  await Promise.resolve();

  return now;
};

describe("a page the back-forward cache restores", () => {
  it("reads nothing for a page nobody was signed in to", async () => {
    const tab = tabAt("/review/synthetic-link", Option.none());
    let read = false;

    const answered = await restoredPage(tab.side, async () => {
      read = true;

      return await answering(Option.some(ada))();
    });

    expect(answered).toBe("stay");
    expect(read).toBeFalsy();
  });

  it("keeps the same person's page", async () => {
    const tab = tabAt("/studio/posts", Option.some(ada));

    await expect(
      restoredPage(tab.side, answering(Option.some(ada)))
    ).resolves.toBe("stay");
    expect(tab.did).toStrictEqual([]);
  });

  it("opens the app's home for someone else", async () => {
    const tab = tabAt("/studio/posts", Option.some(ada));

    await expect(
      restoredPage(tab.side, answering(Option.some(bob)))
    ).resolves.toBe("openHome");
    expect(tab.did).toStrictEqual(["markLeaving", "openHome"]);
  });

  it("loads the page again once signed out", async () => {
    const tab = tabAt("/studio/posts", Option.some(ada));

    await expect(
      restoredPage(tab.side, answering(Option.none()))
    ).resolves.toBe("reloadHere");
    expect(tab.did).toStrictEqual(["markLeaving", "reloadHere"]);
  });

  it("stays as it is when the session cannot be read", async () => {
    const tab = tabAt("/studio/posts", Option.some(ada));

    await expect(
      restoredPage(tab.side, async () => {
        await Promise.resolve();

        throw new Error("synthetic unreachable server");
      })
    ).resolves.toBe("stay");
    expect(tab.did).toStrictEqual([]);
  });
});
