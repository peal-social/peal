import { Schema } from "effect";

import type { AdNetwork } from "./ad-network.ts";

/** An ISO 4217 currency code, as ad networks write them: `EUR`, `USD`. */
export const CurrencySchema = Schema.String.check(
  Schema.isPattern(/^[A-Z]{3}$/u)
).pipe(Schema.brand("Currency"));

export type Currency = typeof CurrencySchema.Type;

/** The largest amount Peal keeps, in minor units: no budget comes near. */
export const maxAmount = 1_000_000_000_000;

/**
 * An amount in a currency's minor units, as the ad network counts them: a
 * whole number, never a fraction, so no sum ever rounds.
 */
export const AmountSchema = Schema.Int.check(
  Schema.isBetween({ maximum: maxAmount, minimum: 0 })
);

/**
 * Money: an amount in the minor units of its currency (cents for EUR and
 * USD, yen for JPY). Amounts of different currencies are never added or
 * compared: `sameCurrency` is checked first.
 */
export class Money extends Schema.Class<Money>("peal-server/ads/domain/Money")({
  amount: AmountSchema,
  currency: CurrencySchema,
}) {}

// Meta's "Currencies" page: budgets are in the currency's smallest
// denomination, a hundredth of the unit for most (offset 100) and the unit
// itself for these (offset 1).
const metaWholeUnitCurrencies: ReadonlySet<string> = new Set([
  "CLP",
  "COP",
  "CRC",
  "HUF",
  "IDR",
  "ISK",
  "JPY",
  "KRW",
  "PYG",
  "TWD",
  "VND",
]);

// ISO 4217's list of currencies with no minor unit (the "Minor unit"
// column at 0, "List one: currency and funds codes", read 2026-11-16),
// for Google Ads, which writes money as millionths of the unit whatever
// the currency. The few with three decimals (BHD, KWD and others) are
// counted in hundredths there, rounded up as everything is.
const isoWholeUnitCurrencies: ReadonlySet<string> = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/**
 * How many decimal digits separate a currency's unit from the minor unit
 * Peal counts the network's amounts in: 2 for most, 0 for whole units.
 * On Meta it follows Meta's own table, not ISO 4217's, which gives some of
 * these currencies decimals Meta does not use; on Google, which counts in
 * micros, ISO 4217's.
 */
export const minorUnitDigits = (
  network: AdNetwork,
  currency: Currency
): 0 | 2 =>
  (network === "meta" ? metaWholeUnitCurrencies : isoWholeUnitCurrencies).has(
    currency
  )
    ? 0
    : 2;

const decimal = /^(?<whole>\d{1,13})(?:\.(?<fraction>\d{1,6}))?$/u;

/**
 * The minor units a decimal amount in whole units names, as networks
 * report what was spent (`"12.5"` is 1250 cents): read digit by digit,
 * never through a float, and rounded up, so spend is never understated.
 * Undefined for anything that is not a plain decimal number.
 */
export const minorUnitsOf = (
  written: string,
  digits: 0 | 2
): number | undefined => {
  const groups = decimal.exec(written)?.groups;

  if (groups === undefined) {
    return undefined;
  }

  const fraction = (groups["fraction"] ?? "").padEnd(6, "0");
  const kept = digits === 0 ? "" : fraction.slice(0, digits);
  const dropped = fraction.slice(digits);

  const amount =
    Number(`${groups["whole"] ?? "0"}${kept}`) +
    (/[1-9]/u.test(dropped) ? 1 : 0);

  return amount > maxAmount ? undefined : amount;
};

const micros = /^\d{1,25}$/u;

/**
 * The minor units an amount in micros names, as Google Ads writes money (a
 * whole number of millionths of the unit, in a JSON string, int64): read
 * with `BigInt`, never through a float, and rounded up, so spend is never
 * understated. Undefined for anything but digits, or past `maxAmount`.
 */
export const minorUnitsOfMicros = (
  written: string,
  digits: 0 | 2
): number | undefined => {
  if (!micros.test(written)) {
    return undefined;
  }

  const perMinorUnit = digits === 0 ? 1_000_000n : 10_000n;
  const value = BigInt(written);

  const amount = value / perMinorUnit + (value % perMinorUnit === 0n ? 0n : 1n);

  return amount > BigInt(maxAmount) ? undefined : Number(amount);
};
