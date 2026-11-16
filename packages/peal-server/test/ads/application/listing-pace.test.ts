// Listing the accounts a sign-in reaches spends Google Ads operations of a
// daily allowance every workspace shares: a listing is kept for the next
// steps of the same sign-in, limited per sign-in and per workspace, and
// drawn from a daily budget of operations.
import { assert, layer } from "@effect/vitest";
import { Duration, Effect, Exit } from "effect";

import { AdConnections } from "#ads/application/ad-connections.ts";
import { AccountStore } from "#ads/application/ports/account-store.ts";
import { SyncAccount } from "#ads/application/sync-account.ts";
import { AdAccountIdSchema } from "#ads/domain/ids.ts";
import {
  listingPaceDefaults,
  memoryListingPace,
} from "#ads/infrastructure/memory-listing-pace.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { routeOf } from "#test/ads/fakes/fake-google-ads-api.ts";
import type { FakeGoogleAdsOptions } from "#test/ads/fakes/fake-google-ads-api.ts";
import {
  adsTestWith,
  connected,
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

// A client account read through its manager.
const managed: FakeGoogleAdsOptions = {
  accessible: ["2222222222"],
  customers: [
    {
      clients: ["3333333333"],
      currencyCode: "EUR",
      descriptiveName: "Example Agency",
      id: "2222222222",
      manager: true,
      timeZone: "Europe/Paris",
    },
    {
      currencyCode: "EUR",
      descriptiveName: "Example Client",
      id: "3333333333",
      timeZone: "Europe/Paris",
    },
  ],
};

const nowhere = "01900000-0000-7000-8000-000000000000";

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
      operationsPerDay: 8,
      operationsPerWorkspaceDay: 4,
    })
  ),
  { excludeTestServices: true }
)("the listings' daily budget of operations", (it) => {
  it.effect(
    "gives each workspace its share, so one cannot keep another from connecting, within the server's",
    () =>
      Effect.gen(function* budget() {
        const api = yield* onGoogle(three);
        const first = yield* freshOwner;
        const second = yield* freshOwner;
        const third = yield* freshOwner;

        yield* signIn(first, "google");

        // The first workspace spent its share: it waits, the others do not.
        assert.strictEqual(
          (yield* refusalOf(signIn(first, "google")))?._tag,
          "AdNetworkUnavailable"
        );

        yield* signIn(second, "google");

        // The server's budget is spent too.
        assert.strictEqual(
          (yield* refusalOf(signIn(third, "google")))?._tag,
          "AdNetworkUnavailable"
        );
        assert.strictEqual(listings(api.requests()), 2);
      })
  );
});

layer(
  adsTestWith(
    MeteredUsage.layerUnmetered,
    memoryListingPace(listingPaceDefaults)
  ),
  { excludeTestServices: true }
)("a read that looks for another way to an account", (it) => {
  it.effect(
    "reads the sign-in's kept listing rather than ask Google again",
    () =>
      Effect.gen(function* kept() {
        const api = yield* onGoogle(managed);
        const owner = yield* freshOwner;
        const sync = yield* SyncAccount;

        yield* connected(owner, ["3333333333"], "google");

        const [account] = yield* AccountStore.use((store) =>
          store.list(owner.workspaceId)
        );

        api.setClients("2222222222", []);

        assert.strictEqual(
          yield* sync.run(
            account?.account.id ?? AdAccountIdSchema.make(nowhere)
          ),
          "postponed"
        );
        assert.strictEqual(listings(api.requests()), 1);
      })
  );
});

layer(adsTestWith(MeteredUsage.layerUnmetered), {
  excludeTestServices: true,
})("an account no way reaches", (it) => {
  it.effect(
    "is not listed for again at its next reads, until a member lists",
    () =>
      Effect.gen(function* unreachable() {
        const api = yield* onGoogle(managed);
        const owner = yield* freshOwner;
        const sync = yield* SyncAccount;
        const connections = yield* AdConnections;

        const { connection } = yield* connected(
          owner,
          ["3333333333"],
          "google"
        );

        const [account] = yield* AccountStore.use((store) =>
          store.list(owner.workspaceId)
        );

        const accountId =
          account?.account.id ?? AdAccountIdSchema.make(nowhere);

        api.setClients("2222222222", []);
        yield* sync.run(accountId);

        const afterFirst = listings(api.requests());

        yield* sync.run(accountId);
        yield* sync.run(accountId);

        assert.strictEqual(listings(api.requests()), afterFirst);

        // The member's listing finds the way again, and the read works.
        api.setAccessible(["2222222222", "3333333333"]);
        yield* connections.reachable(owner, connection.grant.id);

        assert.strictEqual(yield* sync.run(accountId), "synced");
      })
  );
});
