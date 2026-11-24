import { useMemo, useSyncExternalStore } from "react";

import { boardFrom, boardKey, boardText } from "./widgets.ts";
import type { Board } from "./widgets.ts";

// A workspace's analytics board, kept in the browser's local storage so
// it stays across reloads, and the same in every tab: a change made in
// one reaches the others through the storage event. Storage may be closed
// to the page: the board then lasts as long as the page.

interface BoardStore {
  readonly snapshot: () => string | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly update: (change: (board: Board) => Board) => void;
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
    // Storage is closed to this page: the board lasts as long as it.
  }
};

const makeBoardStore = (workspaceId: string): BoardStore => {
  const key = boardKey(workspaceId);
  const listeners = new Set<() => void>();
  let stored = read(key);

  const tell = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  // Another tab changed the board.
  const heard = (event: StorageEvent) => {
    if (event.key === key) {
      stored = event.newValue;
      tell();
    }
  };

  return {
    snapshot: () => stored,
    subscribe: (listener) => {
      if (listeners.size === 0) {
        window.addEventListener("storage", heard);
      }

      listeners.add(listener);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          window.removeEventListener("storage", heard);
        }
      };
    },
    update: (change) => {
      stored = boardText(change(boardFrom(stored)));
      write(key, stored);
      tell();
    },
  };
};

/** The workspace's board, and how to change it. */
export const useBoard = (
  workspaceId: string
): readonly [Board, (change: (board: Board) => Board) => void] => {
  const store = useMemo(() => makeBoardStore(workspaceId), [workspaceId]);

  const stored = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    () => null
  );

  const board = useMemo(() => boardFrom(stored), [stored]);

  return [board, store.update] as const;
};
