import type { PostStatus } from "peal-contract";

import type { Page } from "#shell/navigation.ts";

/**
 * The second key of G then … for the pages people open most. Letters stay
 * the same in every language, as the keyboard's do.
 */
export const goKeys: Readonly<Partial<Record<Page, string>>> = {
  analytics: "y",
  calendar: "c",
  general: "s",
  home: "h",
  inbox: "i",
  media: "m",
  posts: "p",
};

/**
 * The second key of G then … for the posts list's tabs people open most,
 * by the status each shows: D its drafts, A those that need an approval.
 * None is a page's (`goKeys`).
 */
export const goViewKeys: Readonly<Partial<Record<PostStatus, string>>> = {
  awaitingApproval: "a",
  draft: "d",
};

/** The key that opens a new post. */
export const newPostKey = "c";

/** The key that opens the command menu: Command or Control with K. */
export const commandMenuKey = "mod+k";

/** The key that shows every shortcut: Command or Control with /. */
export const shortcutSheetKey = "mod+/";

/** The same where / is typed with Shift, as on a French keyboard. */
export const shortcutSheetShiftedKey = "mod+shift+/";

/** The key that takes back the last change a toast offers to undo. */
export const undoKey = "mod+z";

/**
 * The keys of a list whose rows can be chosen (DESIGN.md, "Choosing
 * several"). None is the second key of a G sequence.
 */
export const listKeys = {
  all: "mod+a",
  clear: "escape",
  filter: "f",
  down: "j",
  growDown: "shift+j",
  growUp: "shift+k",
  open: "o",
  toggle: "x",
  up: "k",
} as const;

/** The keys that act on the chosen posts, as in the command menu. */
export const selectionKeys = {
  approve: "v",
  backToDraft: "u",
  cancel: "shift+backspace",
  requestChanges: "r",
  tag: "l",
} as const;
