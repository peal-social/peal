"use client";

import { Option } from "effect";
import { useEffect } from "react";

import { tellOtherTabs } from "#auth/session-news.ts";
import { takeSignIn } from "#auth/sign-in-arrival.ts";
import { tabStorage } from "#auth/signed-out-notice.ts";
import { showPerson } from "#auth/tab-person.ts";

/**
 * Names the person a page was rendered for (`#auth/tab-person.ts`), from
 * the layouts and pages that know who is signed in. A sign-in that was on
 * its way (`#auth/sign-in-arrival.ts`) arrives here: the browser's other
 * tabs are told who signed in, once. Renders nothing.
 */
export const TabPerson = ({ userId }: { readonly userId: string }) => {
  useEffect(() => {
    showPerson(userId);

    const arrived = Option.toArray(tabStorage()).some((storage) =>
      takeSignIn(storage)
    );

    if (arrived) {
      tellOtherTabs({ kind: "signedIn", userId });
    }
  }, [userId]);

  return null;
};
