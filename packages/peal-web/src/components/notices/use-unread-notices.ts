"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { unreadNotices } from "#notices/atoms.ts";
import { useRefreshWhileVisible } from "#notices/use-refresh-while-visible.ts";

// How often the count is asked for while the page is visible. Polling a
// count the database answers from an index is cheap, works through any
// proxy a self-hoster runs, and needs nothing shared between servers;
// notices are not urgent to the second, and the count is also asked for as
// soon as the tab is shown again.
const refreshEvery = 30_000;

/** The unread count, once read, and the sentence announcing new ones. */
export interface UnreadNotices {
  readonly announcement: string;
  readonly unread: Option.Option<number>;
}

/**
 * The person's unread notices, polled while the tab is visible, and the
 * sentence that announces new ones ("2 new notifications") once they
 * arrive. Call it only once the page has hydrated: the count is read with
 * the visitor's cookies, which only the browser sends.
 */
export const useUnreadNotices = (): UnreadNotices => {
  const t = useTranslations("Notices.bell");
  const result = useAtomValue(unreadNotices);
  const refresh = useAtomRefresh(unreadNotices);

  const unread = AsyncResult.value(result).pipe(
    Option.map(({ unread: count }) => count)
  );

  // The count shown last, to tell how many arrived since. Kept in state and
  // updated while rendering, as React does for values that follow a prop.
  const [shown, setShown] = useState<Option.Option<number>>(Option.none());
  const [announcement, setAnnouncement] = useState("");

  if (Option.isSome(unread) && !Option.contains(shown, unread.value)) {
    if (Option.isSome(shown) && unread.value > shown.value) {
      setAnnouncement(t("arrived", { count: unread.value - shown.value }));
    }

    setShown(unread);
  }

  useRefreshWhileVisible(refresh, refreshEvery);

  return { announcement, unread };
};
