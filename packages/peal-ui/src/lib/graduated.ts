// Graduated pricing, as a pricing calculator shows it: each band's price
// applies to the units inside that band only. The bands come from the
// page (the contract's rate card); a test there checks this agrees with
// the contract's own sums.

/** A band: its monthly price per unit, and its last unit, none for the top. */
interface PriceBand {
  readonly monthly: number;
  readonly upTo: number | null;
}

/** How many units fall into a band, and what they cost. */
interface BandShare {
  readonly band: PriceBand;
  readonly cost: number;
  /** The band's first unit. */
  readonly from: number;
  readonly units: number;
}

/** The units in each band, from the first band up, for `units` in all. */
const sharesOf = (bands: readonly PriceBand[], units: number): BandShare[] => {
  const shares: BandShare[] = [];
  let from = 1;

  for (const band of bands) {
    const last = band.upTo ?? Number.POSITIVE_INFINITY;
    const inBand = Math.max(0, Math.min(units, last) - from + 1);

    if (inBand > 0) {
      shares.push({ band, cost: inBand * band.monthly, from, units: inBand });
    }

    from = last + 1;
  }

  return shares;
};

/** What `units` cost a month, in the bands' unit (cents). */
const graduatedTotal = (bands: readonly PriceBand[], units: number): number =>
  sharesOf(bands, units).reduce((sum, share) => sum + share.cost, 0);

export { graduatedTotal, sharesOf };

export type { BandShare, PriceBand };
