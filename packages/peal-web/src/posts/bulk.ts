import { maxTagsPerPost } from "peal-contract";
import type { PostStatus } from "peal-contract";

// Several posts of the list chosen at once, and what may be done to them
// together: the list's checkboxes, and the bar that acts on the choice.

/** The posts chosen, by id, and the last one clicked, a range's start. */
export interface Selection {
  readonly ids: ReadonlySet<string>;
  readonly anchor: string | null;
}

export const noSelection: Selection = { anchor: null, ids: new Set() };

/** The choice with one post in or out of it. */
export const toggled = (selection: Selection, id: string): Selection => {
  const ids = new Set(selection.ids);

  if (ids.has(id)) {
    ids.delete(id);
  } else {
    ids.add(id);
  }

  return { anchor: id, ids };
};

/**
 * The choice with every post from the last one clicked to this one, in the
 * list's order, put in (or taken out, as this one goes): what Shift with a
 * click does. Without a last one, or one no longer listed, it toggles this
 * one alone.
 */
export const withRange = (
  selection: Selection,
  order: readonly string[],
  id: string
): Selection => {
  const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor);
  const to = order.indexOf(id);

  if (from === -1 || to === -1) {
    return toggled(selection, id);
  }

  const put = !selection.ids.has(id);
  const ids = new Set(selection.ids);

  for (const listed of order.slice(
    Math.min(from, to),
    Math.max(from, to) + 1
  )) {
    if (put) {
      ids.add(listed);
    } else {
      ids.delete(listed);
    }
  }

  return { anchor: id, ids };
};

/** The choice with every listed post in it: what ⌘A does. */
export const allOf = (order: readonly string[]): Selection => ({
  anchor: order.at(-1) ?? null,
  ids: new Set(order),
});

/**
 * The post after (`step` 1) or before (-1) the focused one, in the list's
 * order: the first or the last without one, and the same at either end.
 */
export const nextFocus = (
  order: readonly string[],
  focused: string | null,
  step: 1 | -1
): string | null => {
  if (order.length === 0) {
    return null;
  }

  const at = focused === null ? -1 : order.indexOf(focused);

  if (at === -1) {
    return step === 1 ? (order[0] ?? null) : (order.at(-1) ?? null);
  }

  return order[Math.min(Math.max(at + step, 0), order.length - 1)] ?? null;
};

/** A choice with the row the keys act on. */
export interface FocusedSelection {
  readonly selection: Selection;
  readonly focused: string | null;
}

/**
 * Shift with J or K: the focused post and the next one are chosen, and
 * the focus moves on, as the range grows from where it started.
 */
export const extended = (
  selection: Selection,
  order: readonly string[],
  focused: string | null,
  step: 1 | -1
): FocusedSelection => {
  const next = nextFocus(order, focused, step);

  if (next === null) {
    return { focused, selection };
  }

  const ids = new Set(selection.ids);

  if (focused !== null) {
    ids.add(focused);
  }

  ids.add(next);

  return { focused: next, selection: { anchor: next, ids } };
};

/** The choice, kept to the posts still listed. */
export const keptTo = (
  selection: Selection,
  order: readonly string[]
): Selection => {
  const listed = new Set(order);
  const ids = new Set([...selection.ids].filter((id) => listed.has(id)));

  return {
    anchor:
      selection.anchor !== null && listed.has(selection.anchor)
        ? selection.anchor
        : null,
    ids,
  };
};

/** What a post's status lets the bar do with it. */
interface Bulk {
  readonly status: PostStatus;
}

/** Back to draft: a post that waits for its time, or for an approval. */
export const mayUnschedule = ({ status }: Bulk): boolean =>
  status === "scheduled" || status === "awaitingApproval";

/** Cancel: a post not yet out, a draft included. */
export const mayCancel = ({ status }: Bulk): boolean =>
  status === "draft" || mayUnschedule({ status });

/** Whether every chosen post has a tag, some do, or none. */
export type TagState = "all" | "none" | "some";

export const tagStateOf = (
  posts: readonly { readonly tagIds: readonly string[] }[],
  tagId: string
): TagState => {
  const holding = posts.filter(({ tagIds }) => tagIds.includes(tagId)).length;

  if (holding === 0) {
    return "none";
  }

  return holding === posts.length ? "all" : "some";
};

/** A post's tags without one, or null when it does not have it. */
export const withoutTag = (
  tagIds: readonly string[],
  tagId: string
): readonly string[] | null =>
  tagIds.includes(tagId) ? tagIds.filter((id) => id !== tagId) : null;

/**
 * A post's tags with one more, or null when it has the tag already, or
 * would hold more than a post may.
 */
export const withTag = (
  tagIds: readonly string[],
  tagId: string
): readonly string[] | null => {
  if (tagIds.includes(tagId) || tagIds.length >= maxTagsPerPost) {
    return null;
  }

  return [...tagIds, tagId];
};
