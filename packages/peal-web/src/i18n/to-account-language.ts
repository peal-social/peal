import { Option } from "effect";
import { hasLocale } from "next-intl";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Me } from "peal-contract";

import {
  accountLanguageAddress,
  pageAddressHeader,
} from "#i18n/account-language.ts";
import { routing } from "#i18n/routing.ts";

/**
 * Sends a page of the signed-in app shown in another language than the
 * account's to the same page in it (`accountLanguageAddress`), before
 * anything of it renders. Called from the layouts that know the page by
 * their route's params: its language, and the first segments of a path
 * they serve, against which the address the proxy hands on is checked.
 * An unknown language is the root layout's 404.
 */
export const toAccountLanguage = async (
  me: Option.Option<Me>,
  locale: string,
  firstSegments: readonly string[]
): Promise<void> => {
  if (hasLocale(routing.locales, locale)) {
    const incoming = await headers();

    const elsewhere = accountLanguageAddress(
      me,
      { firstSegments, locale },
      incoming.get(pageAddressHeader)
    );

    if (Option.isSome(elsewhere)) {
      redirect(elsewhere.value);
    }
  }
};
