import type { PostStatus } from "peal-contract";

import {
  commandMenuKey,
  goKeys,
  goViewKeys,
  listKeys,
  newPostKey,
  selectionKeys,
  shortcutSheetKey,
  undoKey,
} from "#shell/keys.ts";
import type { Page } from "#shell/navigation.ts";

/** What a shortcut does, as the sheet names it (`Shortcuts.rows`). */
export type ShortcutAction =
  | "all"
  | "approve"
  | "backToDraft"
  | "cancel"
  | "clear"
  | "down"
  | "filter"
  | "goTo"
  | "growDown"
  | "growUp"
  | "newPost"
  | "open"
  | "openMenu"
  | "requestChanges"
  | "showShortcuts"
  | "tag"
  | "toggle"
  | "undo"
  | "up";

/**
 * One line of the sheet: what it does, and its keys, in ui-sdk's form.
 * Two keys are a sequence ("G then C"), one a press; `alternate` is a
 * second way to the same, like ↓ for J. `page` names a "Go to" line's
 * page, or `status` the tab of the posts list it opens.
 */
export interface ShortcutRow {
  readonly action: ShortcutAction;
  readonly keys: readonly [string] | readonly [string, string];
  readonly alternate?: string;
  readonly page?: Page;
  readonly status?: PostStatus;
}

export type ShortcutGroupName = "general" | "goTo" | "lists" | "selection";

export interface ShortcutGroup {
  readonly name: ShortcutGroupName;
  readonly rows: readonly ShortcutRow[];
}

// The posts list's tabs that G then a letter opens, in the list's order.
const viewRows: readonly ShortcutRow[] = (
  ["draft", "awaitingApproval"] as const
).flatMap((status) => {
  const key = goViewKeys[status];

  return key === undefined
    ? []
    : [{ action: "goTo", keys: ["g", key], status } as const];
});

/**
 * Every shortcut of a workspace, grouped, for the sheet ⌘/ opens (DESIGN.md,
 * "Keys"): from the same constants the pages bind, so the sheet cannot
 * drift from them. A member sees "Go to" lines for the pages they may open,
 * the posts list's tabs after Posts, and "New post" only when they may
 * write one.
 */
export const shortcutGroupsOf = ({
  canCreate,
  pages,
}: {
  readonly canCreate: boolean;
  /** The pages the member may open, in the menu's order. */
  readonly pages: readonly Page[];
}): readonly ShortcutGroup[] => [
  {
    name: "general",
    rows: [
      { action: "openMenu", keys: [commandMenuKey] },
      { action: "showShortcuts", keys: [shortcutSheetKey] },
      ...(canCreate
        ? [{ action: "newPost", keys: [newPostKey] } as const]
        : []),
      { action: "undo", keys: [undoKey] },
    ],
  },
  {
    name: "goTo",
    rows: pages.flatMap((page) => {
      const key = goKeys[page];
      const views = page === "posts" ? viewRows : [];

      return key === undefined
        ? views
        : [{ action: "goTo", keys: ["g", key], page } as const, ...views];
    }),
  },
  {
    name: "lists",
    rows: [
      { action: "filter", keys: [listKeys.filter] },
      { action: "down", alternate: "arrowdown", keys: [listKeys.down] },
      { action: "up", alternate: "arrowup", keys: [listKeys.up] },
      { action: "toggle", keys: [listKeys.toggle] },
      {
        action: "growDown",
        alternate: "shift+arrowdown",
        keys: [listKeys.growDown],
      },
      { action: "growUp", alternate: "shift+arrowup", keys: [listKeys.growUp] },
      { action: "all", keys: [listKeys.all] },
      { action: "open", alternate: "enter", keys: [listKeys.open] },
      { action: "clear", keys: [listKeys.clear] },
    ],
  },
  {
    name: "selection",
    rows: [
      { action: "tag", keys: [selectionKeys.tag] },
      { action: "approve", keys: [selectionKeys.approve] },
      { action: "requestChanges", keys: [selectionKeys.requestChanges] },
      { action: "backToDraft", keys: [selectionKeys.backToDraft] },
      { action: "cancel", keys: [selectionKeys.cancel] },
    ],
  },
];
