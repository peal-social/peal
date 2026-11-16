import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { ListingLimited } from "#ads/application/listing-limited.ts";
import type { AdAccountFacts } from "#ads/domain/ad-account-facts.ts";
import type { AdGrant } from "#ads/domain/ad-grant.ts";

/**
 * How often the accounts a sign-in reaches are listed from the network.
 * Listing Google Ads accounts spends operations of a daily allowance every
 * workspace of the server shares, so a listing is taken from a budget, and
 * kept a few minutes for the next step of the same sign-in to read.
 */
export class ListingPace extends Context.Service<
  ListingPace,
  {
    /**
     * Takes one listing for the grant: refused past the grant's and the
     * workspace's listings an hour, or once the network's listings spent
     * their budget of operations today, the server's or the workspace's
     * share of it, so one workspace never keeps another from connecting.
     */
    readonly take: (grant: AdGrant) => Effect.Effect<void, ListingLimited>;
    /**
     * Counts what a listing spent against its network's daily budget, the
     * server's and the workspace's share of it.
     */
    readonly spent: (grant: AdGrant, operations: number) => Effect.Effect<void>;
    /** The grant's last listing, while it is fresh. */
    readonly recent: (
      grant: AdGrant
    ) => Effect.Effect<Option.Option<readonly AdAccountFacts[]>>;
    readonly remember: (
      grant: AdGrant,
      accounts: readonly AdAccountFacts[]
    ) => Effect.Effect<void>;
  }
>()("peal-server/ads/application/ListingPace") {}
