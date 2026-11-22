import { describe, expect, it } from "@effect/vitest";

import {
  goKeys,
  goViewKeys,
  listKeys,
  newPostKey,
  selectionKeys,
} from "#shell/keys.ts";
import { shortcutGroupsOf } from "#shell/shortcut-sheet.ts";

const rowsOf = (groups: ReturnType<typeof shortcutGroupsOf>) =>
  groups.flatMap(({ rows }) => rows);

const actionsOf = (canCreate: boolean) =>
  rowsOf(shortcutGroupsOf({ canCreate, pages: [] })).map(
    ({ action }) => action
  );

// The posts list's tabs the sheet's "Go to" lines open.
const viewsOf = (pages: Parameters<typeof shortcutGroupsOf>[0]["pages"]) =>
  rowsOf(shortcutGroupsOf({ canCreate: true, pages })).flatMap(({ status }) =>
    status === undefined ? [] : [status]
  );

// The general group's lines, with or without the agent.
const general = (canAskAgent: boolean) =>
  shortcutGroupsOf({ canAskAgent, canCreate: false, pages: [] })
    .find(({ name }) => name === "general")
    ?.rows.map(({ action }) => action);

describe(shortcutGroupsOf, () => {
  it("lists Go to only for the member's pages that have a key", () => {
    const groups = shortcutGroupsOf({
      canCreate: true,
      pages: ["home", "channels", "posts"],
    });

    expect(
      groups
        .find(({ name }) => name === "goTo")
        ?.rows.map(({ keys, page }) => [page, keys.join(" ")])
    ).toStrictEqual([
      ["home", "g h"],
      ["posts", "g p"],
      [undefined, "g d"],
      [undefined, "g a"],
    ]);
  });

  it("lists the agent's panel only for those who may talk to it", () => {
    expect([general(true), general(false)]).toStrictEqual([
      ["openMenu", "showShortcuts", "openAgent", "undo"],
      ["openMenu", "showShortcuts", "undo"],
    ]);
  });

  it("goes to the Drafts and Needs approval tabs only with the posts list", () => {
    expect([viewsOf(["home", "posts"]), viewsOf(["home"])]).toStrictEqual([
      ["draft", "awaitingApproval"],
      [],
    ]);
  });

  it("offers New post only to a member who may write one", () => {
    expect([
      actionsOf(true).includes("newPost"),
      actionsOf(false).includes("newPost"),
    ]).toStrictEqual([true, false]);
  });

  it("gives every line a key of its own", () => {
    const keys = rowsOf(
      shortcutGroupsOf({ canCreate: true, pages: ["home", "posts"] })
    ).flatMap(({ alternate, keys: pressed }) => [
      pressed.join(" "),
      ...(alternate === undefined ? [] : [alternate]),
    ]);

    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("never binds a list's key to G, New post or a G sequence's second key", () => {
    const taken = new Set([
      "g",
      newPostKey,
      ...Object.values(goKeys),
      ...Object.values(goViewKeys),
    ]);

    const clashes = [
      ...Object.values(listKeys),
      ...Object.values(selectionKeys),
    ].filter((key) => taken.has(key));

    expect(clashes).toStrictEqual([]);
  });
});
