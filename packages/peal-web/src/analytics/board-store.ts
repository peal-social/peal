import { Option } from "effect";
import { useMemo, useSyncExternalStore } from "react";

import { browserStorage, dropWorkspaceKey } from "#auth/person-storage.ts";
import type { KeptFor, PersonStorage } from "#auth/person-storage.ts";

import { boardFrom, boardKey, boardText } from "./widgets.ts";
import type { Board } from "./widgets.ts";

// The person's analytics board of a workspace, kept in the browser's
// local storage so it stays across reloads, and the same in every tab: a
// change made in one reaches the others through the storage event. Each
// person signed in on the browser has their own (`boardKey`). Storage
// may be closed to the page: the board then lasts as long as the page.

interface BoardStore {
  readonly snapshot: () => string | null;
  readonly subscribe: (listener: () => void) => () => void;
  readonly update: (change: (board: Board) => Board) => void;
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
      // Storage is closed to this page: the board lasts as long as it.
    }
  }
};

/**
 * The person's board of the workspace. A board an older page kept under
 * the workspace alone, which could be anyone's, is dropped, never shown:
 * the person starts from the default board. Nothing is written until
 * the person changes their board.
 */
export const makeBoardStore = (
  owner: KeptFor,
  storage: Option.Option<PersonStorage> = browserStorage()
): BoardStore => {
  const key = boardKey(owner);
  const listeners = new Set<() => void>();

  for (const kept of Option.toArray(storage)) {
    dropWorkspaceKey(kept, "analytics-board", owner.workspaceId);
  }

  let stored = read(storage, key);

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
      write(storage, key, stored);
      tell();
    },
  };
};

/** The person's board of the workspace, and how to change it. */
export const useBoard = ({
  userId,
  workspaceId,
}: KeptFor): readonly [Board, (change: (board: Board) => Board) => void] => {
  const store = useMemo(
    () => makeBoardStore({ userId, workspaceId }),
    [userId, workspaceId]
  );

  const stored = useSyncExternalStore(
    store.subscribe,
    store.snapshot,
    () => null
  );

  const board = useMemo(() => boardFrom(stored), [stored]);

  return [board, store.update] as const;
};
