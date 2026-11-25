"use client";

import { Option } from "effect";
import { useEffect, useRef } from "react";

import { authClient } from "#auth/client.ts";
import { heardOtherTab, restoredPage } from "#auth/other-tabs.ts";
import type { TabSide } from "#auth/other-tabs.ts";
import { markLeaving, tabPerson } from "#auth/tab-person.ts";
import { useLoadAnew } from "#auth/use-load-anew.ts";
import { usePathname } from "#i18n/navigation.ts";

// Who is signed in now, as the server answers: none once signed out.
const signedInNow = async (): Promise<Option.Option<string>> => {
  const { data, error } = await authClient.getSession();

  if (error !== null) {
    throw new Error("The session could not be read.");
  }

  return Option.fromNullishOr(data?.user.id);
};

/**
 * Follows what the browser's other tabs of the app say of the session
 * (`#auth/session-news.ts`), and a page the back-forward cache restores:
 * a tab whose person changed loads the app anew, and one whose person did
 * not keeps what it holds (`#auth/other-tabs.ts`). Renders nothing.
 */
export const OtherTabsSession = () => {
  const loadAnew = useLoadAnew();
  const pathname = usePathname();
  const path = useRef(pathname);

  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const tab: TabSide = {
      markLeaving,
      openHome: () => {
        loadAnew("/");
      },
      pathname: () => path.current,
      reloadHere: () => {
        window.location.reload();
      },
      shown: tabPerson,
    };

    const heard = (change: StorageEvent) => {
      heardOtherTab(tab, change);
    };

    const shown = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void restoredPage(tab, signedInNow);
      }
    };

    window.addEventListener("storage", heard);
    window.addEventListener("pageshow", shown);

    return () => {
      window.removeEventListener("storage", heard);
      window.removeEventListener("pageshow", shown);
    };
  }, [loadAnew]);

  return null;
};
