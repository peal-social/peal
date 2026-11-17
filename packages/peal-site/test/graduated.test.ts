// The pricing calculator works its totals out in the browser, with
// peal-ui's graduated sums: they must be the contract's, which bills.
import { accountsMonthly, rateCard } from "peal-contract/rate-card";
import { graduatedTotal, sharesOf } from "peal-ui/lib/graduated";
import { describe, expect, it } from "vitest";

const { bands } = rateCard.prices.usd.accounts;

const counts = Array.from({ length: 2001 }, (_unused, index) => index);

describe("the pricing calculator's sums", () => {
  it("costs what the contract bills for every count up to 2,000", () => {
    expect(
      counts.map((accounts) => graduatedTotal(bands, accounts))
    ).toStrictEqual(counts.map((accounts) => accountsMonthly(accounts)));
  });

  it("puts every account in exactly one band", () => {
    for (const accounts of counts) {
      const units = sharesOf(bands, accounts).reduce(
        (sum, share) => sum + share.units,
        0
      );

      expect(units).toBe(accounts);
    }
  });
});
