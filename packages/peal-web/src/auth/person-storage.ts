import { Option } from "effect";

// What the browser keeps of a person's work in a workspace (the Studio's
// draft, the agent panel's tabs, the analytics board) is keyed by the
// person and the workspace, `peal.<kind>.<userId>.<workspaceId>`: on a
// shared computer, the next member of the same workspace loads none of
// it, and the person finds their own again once back. Keys an older page
// named by the workspace alone are never read, and dropped as found.
// Deleting the account forgets all of the person's (`forgetPersonKeys`).

/** What a page reads and writes of the browser's `localStorage`. */
export type PersonStorage = Pick<
  Storage,
  "getItem" | "key" | "length" | "removeItem" | "setItem"
>;

/** What the browser keeps per person and workspace. */
export type KeptKind = "agent-panel" | "analytics-board" | "studio-draft";

/**
 * Where an older page kept each kind under the workspace alone, which
 * anyone signed in to it would have loaded.
 */
const workspaceKeys: Readonly<
  Record<KeptKind, (workspaceId: string) => string>
> = {
  "agent-panel": (workspaceId) => `peal.agent-panel.${workspaceId}`,
  "analytics-board": (workspaceId) => `peal.analytics.board.${workspaceId}`,
  "studio-draft": (workspaceId) => `peal.studio-draft.${workspaceId}`,
};

const keptKinds: readonly KeptKind[] = [
  "agent-panel",
  "analytics-board",
  "studio-draft",
];

/** Whose work it is, and in which workspace. */
export interface KeptFor {
  readonly userId: string;
  readonly workspaceId: string;
}

/** Where the browser keeps a person's work of a kind in a workspace. */
export const personKeyOf = (
  kind: KeptKind,
  { userId, workspaceId }: KeptFor
): string => `peal.${kind}.${userId}.${workspaceId}`;

/**
 * The page's `localStorage`, or none where the browser refuses it, and
 * on the server, which renders with no window (and never a storage that
 * every request would share).
 */
export const browserStorage = (): Option.Option<PersonStorage> => {
  try {
    return Option.fromNullOr(window.localStorage);
  } catch {
    // No window, or storage the browser refuses (some private modes).
    return Option.none();
  }
};

/**
 * Drops what an older page kept of this kind under the workspace alone,
 * which anyone signed in to it would have loaded.
 */
export const dropWorkspaceKey = (
  storage: PersonStorage,
  kind: KeptKind,
  workspaceId: string
): void => {
  try {
    storage.removeItem(workspaceKeys[kind](workspaceId));
  } catch {
    // Storage is closed to the page: nothing to drop.
  }
};

/**
 * Forgets everything the browser keeps of the person, in every
 * workspace: once their account is deleted.
 */
export const forgetPersonKeys = (
  storage: Option.Option<PersonStorage>,
  userId: string
): void => {
  const prefixes = keptKinds.map((kind) => `peal.${kind}.${userId}.`);

  for (const kept of Option.toArray(storage)) {
    try {
      const theirs = Array.from({ length: kept.length }, (_, index) =>
        kept.key(index)
      ).filter(
        (key): key is string =>
          key !== null && prefixes.some((prefix) => key.startsWith(prefix))
      );

      for (const key of theirs) {
        kept.removeItem(key);
      }
    } catch {
      // Storage is closed to the page: it keeps nothing of theirs.
    }
  }
};
