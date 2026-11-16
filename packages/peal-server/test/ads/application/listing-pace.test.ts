// Listing the accounts a sign-in reaches spends Google Ads operations of a
// daily allowance every workspace shares: a listing is kept for the next
// steps of the same sign-in, limited per sign-in and per workspace, and
// drawn from a daily budget of operations.
import { assert, layer } from "@effect/vitest";
import { Duration, Effect, Exit } from "effect";

import { AdConnections } from "#ads/application/ad-connections.ts";
import {
  listingPaceDefaults,
  memoryListingPace,
} from "#ads/infrastructure/memory-listing-pace.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { routeOf } from "#test/ads/fakes/fake-google-ads-api.ts";
import type { FakeGoogleAdsOptions } from "#test/ads/fakes/fake-google-ads-api.ts";
import {
  adsTestWith,
  freshOwner,
  onGoogle,
  signIn,
} from "#test/ads/support.ts";

// Three accounts the person uses directly: a listing spends four
// operations, the list and one search each.
const three: FakeGoogleAdsOptions = {
  accessible: ["1111111111", "2222222222", "3333333333"],
  customers: ["1111111111", "2222222222", "3333333333"].map((id) => ({
    currencyCode: "EUR",
    descriptiveName: `Example ${id}`,
    id,
    timeZone: "Europe/Paris",
  })),
};

const listings = (requests: readonly Parameters<typeof routeOf>[0][]): number =>
  requests.filter(
    (sent) => routeOf(sent) === "GET /v26/customers:listAccessibleCustomers"
  ).length;

const refusalOf = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>
) =>
  effect.pipe(
    Effect.exit,
    Effect.map((exit) =>
      Exit.isFailure(exit) ? exit.cause.reasons[0] : undefined
    ),
    Effect.map((reason) =>
      reason !== undefined && reason._tag === "Fail" ? reason.error : undefined
    )
  );

layer(
  adsTestWith(
    MeteredUsage.layerUnmetered,
    memoryListingPace({ ...listingPaceDefaults, perGrantHour: 3 })
  ),
  { excludeTestServices: true }
)("a sign-in's listing, kept and limited", (it) => {
  it.effect(
    "is asked of Google once for a sign-in and the steps right after",
    () =>
      Effect.gen(function* kept() {
        const api = yield* onGoogle(three);
        const owner = yield* freshOwner;
        const connections = yield* AdConnections;
        const { connection } = yield* signIn(owner, "google");

        yield* connections.reachable(owner, connection.grant.id);
        yield* connections.connect(owner, connection.grant.id, ["1111111111"]);

        assert.strictEqual(listings(api.requests()), 1);
      })
  );

  it.effect(
    "is refused past the sign-in's listings an hour, with the wait",
    () =>
      Effect.gen(function* limited() {
        const api = yield* onGoogle(three);
        const owner = yield* freshOwner;

        // A new sign-in renews the grant, whose listing is then another.
        yield* signIn(owner, "google");
        yield* signIn(owner, "google");
        yield* signIn(owner, "google");

        const refused = yield* refusalOf(signIn(owner, "google"));

        assert.strictEqual(refused?._tag, "AdNetworkUnavailable");
        assert.isTrue(
          refused?._tag === "AdNetworkUnavailable" &&
            refused.retryAfter !== undefined &&
            Duration.isGreaterThan(refused.retryAfter, Duration.zero)
        );
        assert.strictEqual(listings(api.requests()), 3);
      })
  );
});

layer(
  adsTestWith(
    MeteredUsage.layerUnmetered,
    memoryListingPace({
      ...listingPaceDefaults,
      keptFor: Duration.zero,
      operationsPerDay: 4,
    })
  ),
  { excludeTestServices: true }
)("the listings' daily budget of operations", (it) => {
  it.effect("is shared by every workspace, and refuses once spent", () =>
    Effect.gen(function* budget() {
      const api = yield* onGoogle(three);
      const first = yield* freshOwner;
      const other = yield* freshOwner;

      yield* signIn(first, "google");

      const refused = yield* refusalOf(signIn(other, "google"));

      assert.strictEqual(refused?._tag, "AdNetworkUnavailable");
      assert.strictEqual(listings(api.requests()), 1);
    })
  );
});
