"use client";

import { Option } from "effect";
import { useLocale } from "next-intl";
import { forgetConversation } from "peal-ui/lib/support/crisp";
import { useCallback, useState } from "react";

import { authClient } from "#auth/client.ts";
import { tellOtherTabs } from "#auth/session-news.ts";
import { signOutAndLoad } from "#auth/sign-out.ts";
import type { SignOutRequest } from "#auth/sign-out.ts";
import { keepSignedOutNotice, tabStorage } from "#auth/signed-out-notice.ts";
import { loadAnew } from "#auth/use-load-anew.ts";
import type { AppHref } from "#auth/use-load-anew.ts";
import { useMeasurementSignOut } from "#components/measurement/measurement.tsx";
import { getPathname } from "#i18n/navigation.ts";

/** A way out of the app: where it goes, and what a refusal does. */
export interface SignOutOptions extends Omit<SignOutRequest, "to"> {
  /** The next page, as the app's links name it (no locale prefix). */
  readonly to: AppHref;
}

/** The app's one sign-out, and whether the tab is on its way out. */
export interface SignOut {
  /**
   * True from a sign-out that worked until the next page replaces this
   * one, so the button that started it stays busy.
   */
  readonly leaving: boolean;
  /** Signs out and loads `to` anew: whether the tab is leaving. */
  readonly signOut: (options: SignOutOptions) => Promise<boolean>;
}

/**
 * Every way out of the app (the account menu's and the setup page's Sign
 * out, the Security page's Sign in again, deleting the account) signs out
 * here: Better Auth ends the session, the measurement and the support
 * chat forget the person, the other tabs are told (and load the app
 * anew), then the browser loads the next page anew, which drops what the
 * tab held for them (`#auth/sign-out.ts`).
 */
export const useSignOut = (): SignOut => {
  const locale = useLocale();
  const forgetMeasurement = useMeasurementSignOut();
  const [leaving, setLeaving] = useState(false);

  const signOut = useCallback(
    async ({ to, ...request }: SignOutOptions) => {
      const left = await signOutAndLoad(
        {
          endSession: async () => {
            const { error } = await authClient.signOut();

            return error === null;
          },
          forgetConversation,
          forgetMeasurement,
          keepNotice: (notice) => {
            for (const storage of Option.toArray(tabStorage())) {
              keepSignedOutNotice(storage, notice);
            }
          },
          load: loadAnew,
          tellOtherTabs: () => {
            tellOtherTabs({ kind: "signedOut" });
          },
        },
        { ...request, to: getPathname({ href: to, locale }) }
      );

      if (left) {
        setLeaving(true);
      }

      return left;
    },
    [forgetMeasurement, locale]
  );

  return { leaving, signOut };
};
