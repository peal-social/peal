import { DateTime } from "effect";

import type { Locale } from "./locale.ts";

/**
 * An instant as an email writes it. Readers' time zones are not known:
 * instants are written in UTC, and say so.
 */
export const instantIn = (instant: DateTime.Utc, locale: Locale): string =>
  `${DateTime.format(instant, {
    dateStyle: "long",
    locale,
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;

/** An amount in its currency's cents, as the reader writes money. */
export const moneyIn = (
  { amount, currency }: { readonly amount: number; readonly currency: string },
  locale: Locale
): string =>
  new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amount / 100);

const placeholder = /\{(?<name>\w+)\}/gu;

/** A catalogue's words, each `{name}` replaced by its value. */
export const fill = (
  template: string,
  values: ReadonlyMap<string, string>
): string =>
  template.replaceAll(
    placeholder,
    (match, name: string) => values.get(name) ?? match
  );
