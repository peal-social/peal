import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { panelStorageKey } from "#agent/panel-state.ts";
import { makePanelStore } from "#agent/panel-store.ts";
import { forgetPersonKeys } from "#auth/person-storage.ts";
import type { PersonStorage } from "#auth/person-storage.ts";
import { clearDraft, readDraft, writeDraft } from "#studio/draft.ts";
import { emptyEdit, textClipOf } from "#studio/edit-document.ts";

// A browser's `localStorage` in memory, shared by whoever signs in on it.
const memoryStorage = (
  kept: Readonly<Record<string, string>> = {}
): PersonStorage & { readonly items: Map<string, string> } => {
  const items = new Map(Object.entries(kept));

  return {
    getItem: (key) => items.get(key) ?? null,
    items,
    key: (index) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
};

const ada = { userId: "user-ada", workspaceId: "workspace-1" };
const bob = { userId: "user-bob", workspaceId: "workspace-1" };
const edit = emptyEdit([textClipOf("Synthetic draft", 0)]);

describe("the Studio's draft in a shared browser", () => {
  it("is the person's own: another member of the workspace loads none", () => {
    const storage = memoryStorage();

    writeDraft(ada, edit, Option.some(storage));

    expect(readDraft(bob, Option.some(storage))).toStrictEqual(Option.none());
    expect(readDraft(ada, Option.some(storage))).toStrictEqual(
      Option.some(edit)
    );
  });

  it("is still the person's once they come back, until they start over", () => {
    const storage = memoryStorage();

    writeDraft(ada, edit, Option.some(storage));
    writeDraft(bob, emptyEdit([]), Option.some(storage));
    clearDraft(bob, Option.some(storage));

    expect(readDraft(ada, Option.some(storage))).toStrictEqual(
      Option.some(edit)
    );
    expect(readDraft(bob, Option.some(storage))).toStrictEqual(Option.none());
  });

  it("ignores a draft kept under the workspace alone, and drops it", () => {
    const storage = memoryStorage({
      "peal.studio-draft.workspace-1": JSON.stringify({ edit, version: 1 }),
    });

    expect(readDraft(bob, Option.some(storage))).toStrictEqual(Option.none());
    expect([...storage.items.keys()]).toStrictEqual([]);
  });
});

describe("the agent panel's tabs in a shared browser", () => {
  it("are kept per person and workspace", () => {
    expect(panelStorageKey(ada)).toBe("peal.agent-panel.user-ada.workspace-1");
    expect(panelStorageKey(ada)).not.toBe(panelStorageKey(bob));
  });

  it("ignore the tabs kept under the workspace alone, and drop them", () => {
    const storage = memoryStorage({
      "peal.agent-panel.workspace-1": JSON.stringify({
        shown: "chat-1",
        tabs: ["chat-1"],
      }),
    });

    const store = makePanelStore(bob, Option.some(storage));

    expect(store.snapshot()).toBeNull();
    expect([...storage.items.keys()]).toStrictEqual([]);
  });
});

describe("a deleted account's keys", () => {
  it("go from the browser, in every workspace, and only theirs", () => {
    const storage = memoryStorage({
      "peal.agent-panel.user-ada.workspace-1": "{}",
      "peal.agent-panel.user-bob.workspace-1": "{}",
      "peal.measurement-news": "{}",
      "peal.studio-draft.user-ada.workspace-1": "{}",
      "peal.studio-draft.user-ada.workspace-2": "{}",
      "peal.studio-draft.user-ada2.workspace-1": "{}",
      "peal.studio-draft.user-bob.workspace-1": "{}",
    });

    forgetPersonKeys(Option.some(storage), "user-ada");

    expect([...storage.items.keys()].toSorted()).toStrictEqual([
      "peal.agent-panel.user-bob.workspace-1",
      "peal.measurement-news",
      "peal.studio-draft.user-ada2.workspace-1",
      "peal.studio-draft.user-bob.workspace-1",
    ]);
  });
});
