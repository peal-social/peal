"use client";

import { useShortcut } from "@ui-sdk/react/shortcuts";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { typingIn } from "#components/undo.tsx";
import {
  allOf,
  extended,
  keptTo,
  nextFocus,
  noSelection,
  toggled,
  withRange,
} from "#posts/bulk.ts";
import type { Selection } from "#posts/bulk.ts";
import { listKeys } from "#shell/keys.ts";

/**
 * How the list chooses posts: the posts chosen, the row the keys act on,
 * and what a click and the pointer do.
 */
export interface Choosing {
  readonly chosen: ReadonlySet<string>;
  readonly focused: string | null;
  readonly onFocus: (postId: string) => void;
  /** `range`: Shift was held, which chooses from the last post clicked. */
  readonly onToggle: (postId: string, range: boolean) => void;
}

/** What `useChoosing` gives the list. */
export interface ListChoice {
  /** Null for a member who may do nothing to several posts at once. */
  readonly choosing: Choosing | null;
  readonly clear: () => void;
  readonly selection: Selection;
}

// The choice and the focused row, for the filters they were made with.
interface ChoiceState {
  readonly focused: string | null;
  readonly query: string;
  readonly selection: Selection;
}

// Brings the focused row into view, as the keys move it.
const reveal = (postId: string | null) => {
  if (postId !== null) {
    document
      .querySelector(`[data-post-row="${CSS.escape(postId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
};

// The letters and arrows act on the list unless a field takes them.
const listHasKeys = () => !typingIn(document.activeElement);

// Enter opens the focused post only while nothing has the focus: a button
// or a link takes Enter for itself.
const nothingFocused = () => {
  const active = document.activeElement;

  return active === null || active === document.body;
};

/**
 * The choice among the listed posts and the row the keys act on, as in
 * DESIGN.md's "Choosing several": the pointer moves the focused row, J
 * and K (or the arrows) too; X chooses it, Shift with J or K grows the
 * range, ⌘A chooses every listed post, Enter or O opens the focused one,
 * Esc lets go. Both are for the filters they were made with (`query`),
 * and keep only posts still listed.
 */
export const useChoosing = ({
  allowed,
  onOpen,
  order,
  query,
}: {
  /** Whether the member may do anything to several posts at once. */
  readonly allowed: boolean;
  readonly onOpen: (postId: string) => void;
  /** The listed posts' ids, in the list's order. */
  readonly order: readonly string[];
  readonly query: string;
}): ListChoice => {
  const t = useTranslations("Posts.Selection");

  const [choice, setChoice] = useState<ChoiceState>({
    focused: null,
    query,
    selection: noSelection,
  });

  const current = choice.query === query ? choice : null;
  const selection = keptTo(current?.selection ?? noSelection, order);

  const focused =
    current?.focused !== null &&
    current?.focused !== undefined &&
    order.includes(current.focused)
      ? current.focused
      : null;

  const set = (next: {
    readonly focused?: string | null;
    readonly selection?: Selection;
  }) => {
    setChoice({
      focused: next.focused === undefined ? focused : next.focused,
      query,
      selection: next.selection ?? selection,
    });
  };

  const clear = () => {
    set({ selection: noSelection });
  };

  const move = (step: 1 | -1) => {
    const next = nextFocus(order, focused, step);

    set({ focused: next });
    reveal(next);
  };

  const grow = (step: 1 | -1) => {
    const next = extended(selection, order, focused, step);

    set(next);
    reveal(next.focused);
  };

  const keys = () => allowed && order.length > 0 && listHasKeys();
  const onFocused = () => keys() && focused !== null;

  const down = () => {
    move(1);
  };

  const up = () => {
    move(-1);
  };

  const growDown = () => {
    grow(1);
  };

  const growUp = () => {
    grow(-1);
  };

  const moving = { repeat: true, when: keys } as const;

  useShortcut(listKeys.clear, clear, {
    description: t("clearKey"),
    when: () => selection.ids.size > 0,
  });

  useShortcut(listKeys.down, down, { ...moving, description: t("downKey") });
  useShortcut("arrowdown", down, { ...moving, description: t("downKey") });
  useShortcut(listKeys.up, up, { ...moving, description: t("upKey") });
  useShortcut("arrowup", up, { ...moving, description: t("upKey") });
  useShortcut(listKeys.growDown, growDown, {
    ...moving,
    description: t("growDownKey"),
  });

  useShortcut("shift+arrowdown", growDown, {
    ...moving,
    description: t("growDownKey"),
  });

  useShortcut(listKeys.growUp, growUp, {
    ...moving,
    description: t("growUpKey"),
  });

  useShortcut("shift+arrowup", growUp, {
    ...moving,
    description: t("growUpKey"),
  });

  useShortcut(
    listKeys.toggle,
    () => {
      if (focused !== null) {
        set({ selection: toggled(selection, focused) });
      }
    },
    { description: t("toggleKey"), when: onFocused }
  );

  useShortcut(
    listKeys.all,
    () => {
      set({ selection: allOf(order) });
    },
    { description: t("allKey"), when: keys }
  );

  const open = () => {
    if (focused !== null) {
      onOpen(focused);
    }
  };

  useShortcut(listKeys.open, open, {
    description: t("openKey"),
    when: onFocused,
  });

  useShortcut("enter", open, {
    description: t("openKey"),
    when: () => onFocused() && nothingFocused(),
  });

  return {
    choosing: allowed
      ? {
          chosen: selection.ids,
          focused,
          onFocus: (postId) => {
            if (postId !== focused) {
              set({ focused: postId });
            }
          },
          onToggle: (postId, range) => {
            set({
              focused: postId,
              selection: range
                ? withRange(selection, order, postId)
                : toggled(selection, postId),
            });
          },
        }
      : null,
    clear,
    selection,
  };
};
