"use client";

import { useShortcut } from "@ui-sdk/react/shortcuts";
import { useTranslations } from "next-intl";
import { toast } from "peal-ui/components/toast";
import { createContext, use, useCallback, useRef } from "react";
import type { ReactNode } from "react";

import { undoKey } from "#shell/keys.ts";

/** A change just made, said in a toast, and how to take it back. */
export interface Undoable {
  /** What happened, as the toast says it. */
  readonly message: string;
  /**
   * Takes the change back. It says what came of it itself, as a toast
   * of its own, so a refusal reads the same as any other.
   */
  readonly undo: () => Promise<void>;
}

/** How long an undoable change's toast stays, in milliseconds. */
export const undoWindowMs = 6000;

// Typing undoes text there: ⌘Z is left to the field.
export const typingIn = (element: Element | null): boolean =>
  element instanceof HTMLElement &&
  (element.isContentEditable ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement);

const OfferUndo = createContext<(change: Undoable) => void>(() => {
  // Outside the provider, a change is not offered for undoing.
});

/** Says a change happened, with Undo beside it, which ⌘Z presses too. */
export const useOfferUndo = (): ((change: Undoable) => void) => use(OfferUndo);

/**
 * Holds the change that can be undone: the latest offered, while its toast
 * shows. ⌘Z (Ctrl+Z elsewhere) undoes it, unless focus is in a field.
 */
export const UndoProvider = ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const t = useTranslations("Toasts");

  const latest = useRef<{
    readonly id: string;
    readonly undo: () => Promise<void>;
  } | null>(null);

  const offer = useCallback(
    ({ message, undo }: Undoable) => {
      const id = toast.success(message, {
        action: { label: t("undo"), onAction: undo },
        duration: undoWindowMs,
        onDismiss: () => {
          if (latest.current?.id === id) {
            latest.current = null;
          }
        },
      });

      latest.current = { id, undo };
    },
    [t]
  );

  useShortcut(
    undoKey,
    () => {
      const change = latest.current;

      if (change === null) {
        return;
      }

      latest.current = null;
      toast.dismiss(change.id);
      void change.undo();
    },
    {
      allowInInput: false,
      description: t("undo"),
      when: () => latest.current !== null && !typingIn(document.activeElement),
    }
  );

  return <OfferUndo value={offer}>{children}</OfferUndo>;
};
