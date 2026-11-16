import { Schema } from "effect";

/**
 * Listing the accounts a sign-in reaches was refused before asking the
 * network: the sign-in or the workspace listed too often this hour, or the
 * listings spent the share of the network's daily allowance they may.
 * `retryAfter` says when one is taken again.
 */
export class ListingLimited extends Schema.TaggedError<ListingLimited>()(
  "ListingLimited",
  { retryAfter: Schema.DurationFromMillis }
) {}
