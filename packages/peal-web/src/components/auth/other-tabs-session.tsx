"use client";

import { Option } from "effect";
import { useEffect } from "react";

import { sessionNewsOf } from "#auth/session-news.ts";
import { useLoadAnew } from "#auth/use-load-anew.ts";

/**
 * Follows what the browser's other tabs of the app say of the session
 * (`#auth/session-news.ts`): once someone signed out or in there, this
 * tab loads the app anew at `/`, which forgets what it held for the last
 * person and opens what the new session leads to (signing in, or the
 * new person's workspace). Renders nothing.
 */
export const OtherTabsSession = () => {
  const loadAnew = useLoadAnew();

  useEffect(() => {
    const heard = (change: StorageEvent) => {
      if (Option.isSome(sessionNewsOf(change))) {
        loadAnew("/");
      }
    };

    window.addEventListener("storage", heard);

    return () => {
      window.removeEventListener("storage", heard);
    };
  }, [loadAnew]);

  return null;
};
