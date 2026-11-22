import { panelStateOf, panelStorageKey } from "#agent/panel-state.ts";
import type { PanelState } from "#agent/panel-state.ts";

// A workspace's panel, kept in the browser's local storage so it stays
// open across pages and reloads, for `useSyncExternalStore`. Storage may
// be closed to the page: the panel then lasts as long as the page.

export interface PanelStore {
  readonly snapshot: () => string | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly update: (change: (state: PanelState) => PanelState) => void;
}

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage is closed to this page, or there is no window.
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is closed to this page: the panel lasts as long as it.
  }
};

export const makePanelStore = (workspaceId: string): PanelStore => {
  const key = panelStorageKey(workspaceId);
  const listeners = new Set<() => void>();
  let stored = read(key);

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
      write(key, stored);

      for (const listener of listeners) {
        listener();
      }
    },
  };
};
