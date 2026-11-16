import { Duration } from "effect";

import type { AdNetwork } from "./ad-network.ts";

/**
 * What a network's adapter reads and allows, which the use cases ask
 * instead of naming a network:
 *
 * - `days`: whether its daily numbers are kept by ad (`insight_days`) or
 *   by campaign (`campaign_days`), when the network has campaigns without
 *   ads to report on.
 * - `spends`: whether Peal makes and runs ads there (boosts).
 * - `reportsReach`, `reportsResults`: whether its days carry reach and
 *   results; where they do not, reach reads 0 and results none, and the
 *   account's `capabilities` tell clients not to show them.
 * - `syncEvery`: how long between two reads of one of its accounts.
 */
export interface NetworkTraits {
  readonly days: "ad" | "campaign";
  readonly reportsReach: boolean;
  readonly reportsResults: boolean;
  readonly spends: boolean;
  readonly syncEvery: Duration.Duration;
}

/**
 * Every network, described. A network added to `AdNetworkSchema` does
 * not compile until it is described here.
 */
export const networkTraits = {
  // Google Ads, read only: campaigns and their days, never an ad. A read
  // costs three operations of the project's daily allowance (Explorer
  // access gives 2,880), so an account is read every six hours, and what
  // is shown is never more than a day old.
  google: {
    days: "campaign",
    reportsReach: false,
    reportsResults: false,
    spends: false,
    syncEvery: Duration.hours(6),
  },
  meta: {
    days: "ad",
    reportsReach: true,
    reportsResults: true,
    spends: true,
    syncEvery: Duration.hours(1),
  },
} as const satisfies Record<AdNetwork, NetworkTraits>;

/** What a network reads and allows. */
export const traitsOf = (network: AdNetwork): NetworkTraits =>
  networkTraits[network];
