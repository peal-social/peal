import { afterEach, describe, expect, it, vi } from "@effect/vitest";

import { openSignInTab } from "#channels/use-run-step.ts";

// What a tab names as its opener: a window, or none once cut off.
interface OpenerWindow {
  readonly kind: "window";
}

type Opener = OpenerWindow | null;

// A tab as `open()` answers it: only what `openSignInTab` touches.
interface FakeTab {
  readonly close: () => void;
  opener: Opener;
}

const blankTab = (): FakeTab => ({
  close: vi.fn<() => void>(),
  opener: { kind: "window" },
});

// A tab of that name already on another site's page, whose `opener` this
// origin may read but not set.
const foreignTab = (): FakeTab => ({
  close: vi.fn<() => void>(),
  get opener(): Opener {
    return { kind: "window" };
  },
  set opener(_value: Opener) {
    throw new DOMException("Blocked a frame", "SecurityError");
  },
});

describe(openSignInTab, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the run's tab with no way back to this one", () => {
    const tab = blankTab();
    const open = vi.fn<(url: string, target: string) => FakeTab>(() => tab);
    vi.stubGlobal("open", open);

    expect(openSignInTab()).toBe(tab);
    expect(open).toHaveBeenCalledWith("", "peal-sign-in");
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("closes a tab of that name left on another site, and opens a blank one in its place", () => {
    const left = foreignTab();
    const fresh = blankTab();

    const open = vi
      .fn<(url: string, target: string) => FakeTab>()
      .mockReturnValueOnce(left)
      .mockReturnValueOnce(fresh);

    vi.stubGlobal("open", open);

    expect(openSignInTab()).toBe(fresh);
    expect(left.close).toHaveBeenCalledOnce();
    expect(open.mock.calls).toStrictEqual([
      ["", "peal-sign-in"],
      ["", "peal-sign-in"],
    ]);
    expect(fresh.opener).toBeNull();
    expect(fresh.close).not.toHaveBeenCalled();
  });

  it("opens none when the tab in its place cannot be cut off either", () => {
    const left = foreignTab();
    const still = foreignTab();
    vi.stubGlobal(
      "open",
      vi
        .fn<() => FakeTab>()
        .mockReturnValueOnce(left)
        .mockReturnValueOnce(still)
    );

    expect(openSignInTab()).toBeNull();
    expect(left.close).toHaveBeenCalledOnce();
    expect(still.close).toHaveBeenCalledOnce();
  });

  it("opens none when the browser gives no second tab", () => {
    const left = foreignTab();
    vi.stubGlobal(
      "open",
      vi
        .fn<() => FakeTab | null>()
        .mockReturnValueOnce(left)
        .mockReturnValueOnce(null)
    );

    expect(openSignInTab()).toBeNull();
    expect(left.close).toHaveBeenCalledOnce();
  });

  it("answers none where the browser opens no tab", () => {
    vi.stubGlobal(
      "open",
      vi.fn<() => null>(() => null)
    );

    expect(openSignInTab()).toBeNull();

    vi.stubGlobal(
      "open",
      vi.fn<() => null>(() => {
        throw new Error("blocked");
      })
    );

    expect(openSignInTab()).toBeNull();
  });
});
