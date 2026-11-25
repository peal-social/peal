import { Option } from "effect";

import { panelStateOf, panelStorageKey } from "#agent/panel-state.ts";
import type { PanelState } from "#agent/panel-state.ts";
import { browserStorage, dropWorkspaceKey } from "#auth/person-storage.ts";
import type { KeptFor, PersonStorage } from "#auth/person-storage.ts";

// The person's panel of a workspace, kept in the browser's local storage
// so it stays open across pages and reloads, for `useSyncExternalStore`.
// Storage may be closed to the page: the panel then lasts as long as the
// page.

export interface PanelStore {
  readonly snapshot: () => string | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly update: (change: (state: PanelState) => PanelState) => void;
}

const read = (
  storage: Option.Option<PersonStorage>,
  key: string
): string | null => {
  try {
    return Option.getOrNull(
      storage.pipe(Option.flatMapNullishOr((kept) => kept.getItem(key)))
    );
  } catch {
    // Storage is closed to this page.
    return null;
  }
};

const write = (
  storage: Option.Option<PersonStorage>,
  key: string,
  value: string
): void => {
  for (const kept of Option.toArray(storage)) {
    try {
      kept.setItem(key, value);
    } catch {
      // Storage is closed to this page: the panel lasts as long as it.
    }
  }
};

/**
 * The person's panel of the workspace. Tabs an older page kept under the
 * workspace alone are dropped, never shown.
 */
export const makePanelStore = (
  owner: KeptFor,
  storage: Option.Option<PersonStorage> = browserStorage()
): PanelStore => {
  const key = panelStorageKey(owner);
  const listeners = new Set<() => void>();

  for (const kept of Option.toArray(storage)) {
    dropWorkspaceKey(kept, "agent-panel", owner.workspaceId);
  }

  let stored = read(storage, key);

  return {
    snapshot: () => stored,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    update: (change) => {
      stored = JSON.stringify(change(panelStateOf(stored)));
      write(storage, key, stored);

      for (const listener of listeners) {
        listener();
      }
    },
  };
};
