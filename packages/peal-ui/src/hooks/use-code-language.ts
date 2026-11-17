"use client";

import { useCallback, useSyncExternalStore } from "react";

// The language a reader picked for code samples, shared by every code block
// on the page and kept for their next visit, as docs sites keep it. Each
// Astro island is a React root of its own, so the choice lives outside
// React: in localStorage, with a copy in memory for a browser that refuses
// storage (a private window, blocked site data), where it then lasts as
// long as the page.

const storageKey = "peal.code-language";

const changed = "peal:code-language";

let remembered: string | null = null;

const read = (): string | null => {
  try {
    return globalThis.localStorage.getItem(storageKey) ?? remembered;
  } catch {
    return remembered;
  }
};

const write = (value: string) => {
  remembered = value;

  try {
    globalThis.localStorage.setItem(storageKey, value);
  } catch {
    // Storage refused: the copy in memory serves this page.
  }

  globalThis.dispatchEvent(new Event(changed));
};

const subscribe = (listener: () => void) => {
  // `storage` carries a choice made in another tab of the site.
  globalThis.addEventListener(changed, listener);
  globalThis.addEventListener("storage", listener);

  return () => {
    globalThis.removeEventListener(changed, listener);
    globalThis.removeEventListener("storage", listener);
  };
};

// The server, and the first render in the browser, know no choice.
const none = () => null;

/**
 * The code language the reader chose, `null` before they chose one, and a
 * function that chooses one for every block on the page.
 */
const useCodeLanguage = () => {
  const language = useSyncExternalStore(subscribe, read, none);

  const choose = useCallback((value: string) => {
    write(value);
  }, []);

  return [language, choose] as const;
};

export { useCodeLanguage };
