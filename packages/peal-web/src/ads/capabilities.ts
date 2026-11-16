import type { AdAccount } from "peal-contract";

type AdAccountCapabilities = NonNullable<AdAccount["capabilities"]>;

/**
 * What Peal reads and does on an ad account, as its network allows: all of
 * it on an account an older server answers, which knew Meta alone.
 */
export const capabilitiesOf = (account: AdAccount): AdAccountCapabilities =>
  account.capabilities ?? {
    ads: true,
    boosts: true,
    reach: true,
    results: true,
  };
