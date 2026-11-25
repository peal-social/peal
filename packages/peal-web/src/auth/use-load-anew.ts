"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";

import { getPathname } from "#i18n/navigation.ts";

/** A page of the app, as its links name it (no locale prefix). */
export type AppHref = Parameters<typeof getPathname>[0]["href"];

/**
 * Loads an address anew, never in place (`router.push`): the browser
 * drops the page with the atom registry (the agent's chats and drafts,
 * kept alive as long as the tab) and every module's state. Whenever the
 * person in the tab changes (signing in or out, staff starting or
 * stopping acting as someone), the next page loads this way.
 */
export const loadAnew = (address: string): void => {
  globalThis.location.assign(address);
};

/** Loads a page of the app anew, in the page's language. */
export const useLoadAnew = (): ((href: AppHref) => void) => {
  const locale = useLocale();

  return useCallback(
    (href: AppHref) => {
      loadAnew(getPathname({ href, locale }));
    },
    [locale]
  );
};
