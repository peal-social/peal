// Google Ads accounts through the use cases, on Postgres, against the
// loopback fake: read only, campaigns and their days, never an ad, never a
// boost, read every six hours.
import { createHash } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option, Ref } from "effect";
import { SqlClient } from "effect/sql";

import { AdConnections } from "#ads/application/ad-connections.ts";
import { AdReports } from "#ads/application/ad-reports.ts";
import { Boosts } from "#ads/application/boosts.ts";
import { AccountStore } from "#ads/application/ports/account-store.ts";
import { ReadModel } from "#ads/application/ports/read-model.ts";
import { SpendAuthorizations } from "#ads/application/spend-authorizations.ts";
import { SyncAccount } from "#ads/application/sync-account.ts";
import type { AdAccount } from "#ads/domain/ad-account.ts";
import { Audience } from "#ads/domain/audience.ts";
import { CurrencySchema } from "#ads/domain/money.ts";
import { utcDayOf } from "#ads/infrastructure/drizzle-read-model.ts";
import type { Actor } from "#shared/domain/access.ts";
import { UserIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  googleAdsError,
  searching,
  toToken,
} from "#test/ads/fakes/fake-google-ads-api.ts";
import type {
  FakeCampaignDay,
  FakeGoogleAdsOptions,
} from "#test/ads/fakes/fake-google-ads-api.ts";
import { TestPosts } from "#test/ads/fakes/test-posts.ts";
import {
  adsTestWith,
  connected,
  eur,
  freshOwner,
  member,
  onGoogle,
  returnedWith,
  signIn,
  tagOf,
  TestNetworks,
} from "#test/ads/support.ts";
import { textOf } from "#test/publishing/fakes/platform-server.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";

const noRange = { from: Option.none(), to: Option.none() };

// A day of the account's calendar, `daysAgo` days back, as Google writes
// `segments.date`.
const dayAgo = (daysAgo: number) =>
  DateTime.now.pipe(
    Effect.map((now) =>
      DateTime.formatIsoDateUtc(
        DateTime.subtract(now, { days: daysAgo, hours: 2 })
      )
    )
  );

const day = (
  date: string,
  more: Partial<FakeCampaignDay> = {}
): FakeCampaignDay => ({
  campaignId: "901",
  clicks: "4",
  costMicros: "2500000",
  customerId: "1111111111",
  date,
  impressions: "300",
  ...more,
});

// A direct account and a manager's client, each with campaigns.
const accounts: FakeGoogleAdsOptions = {
  accessible: ["1111111111", "2222222222"],
  campaigns: [
    {
      advertisingChannelType: "SEARCH",
      amountMicros: "10000000",
      customerId: "1111111111",
      id: "901",
      name: "Winter sale",
      period: "DAILY",
      startDateTime: "2026-01-05 00:00:00",
      status: "ENABLED",
    },
    {
      advertisingChannelType: "PERFORMANCE_MAX",
      customerId: "1111111111",
      id: "902",
      name: "Always on",
      startDateTime: "2026-01-01 00:00:00",
      status: "PAUSED",
    },
    {
      customerId: "3333333333",
      id: "931",
      name: "Client campaign",
      status: "ENABLED",
    },
  ],
  customers: [
    {
      currencyCode: "EUR",
      descriptiveName: "Example Studio",
      id: "1111111111",
      timeZone: "Europe/Paris",
    },
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

// The days the read of `externalId` asked for, in each days' query sent.
const daysAsked = (
  requests: readonly Parameters<ReturnType<typeof searching>>[0][],
  externalId: string
) =>
  requests.flatMap((sent) => {
    if (
      !searching("campaign", true)(sent) ||
      !sent.path.includes(`/${externalId}/`)
    ) {
      return [];
    }

    const range = /BETWEEN '(?<since>[\d-]+)' AND '(?<until>[\d-]+)'/u.exec(
      textOf(sent)
    )?.groups;

    return [
      Math.round(
        (Date.parse(range?.["until"] ?? "") -
          Date.parse(range?.["since"] ?? "")) /
          86_400_000
      ),
    ];
  });

const campaignDaysOf = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql<{
        readonly count: number;
      }>`SELECT count(*)::int AS count FROM ads.campaign_days WHERE workspace_id = ${workspaceId}`
  ).pipe(
    Effect.orDie,
    Effect.map(([row]) => row?.count ?? 0)
  );

const due = (account: AdAccount, after: Duration.Input) =>
  Effect.gen(function* dueBy() {
    const store = yield* AccountStore;
    const now = yield* DateTime.now;

    const listed = yield* store.dueForSync(
      DateTime.addDuration(now, Duration.fromInputUnsafe(after)),
      10_000,
      Option.none()
    );

    return listed.some((entry) => entry.account.id === account.id);
  });

const dueAt = (account: AdAccount, at: DateTime.Utc) =>
  AccountStore.use((store) => store.dueForSync(at, 10_000, Option.none())).pipe(
    Effect.map((listed) =>
      listed.some((entry) => entry.account.id === account.id)
    )
  );

// The owner's Google sign-in with one account connected: that account.
const connectedGoogle = (owner: Actor, externalId = "1111111111") =>
  connected(owner, [externalId], "google").pipe(
    Effect.flatMap(({ accounts: added, connection }) =>
      Effect.fromNullishOr(added[0]?.account).pipe(
        Effect.orDie,
        Effect.map((account) => ({ account, connection }))
      )
    )
  );

// A server that bills, whose meter would count every managed ad.
const BillingTest = (() => {
  const meters = fakeMeters({ allowed: Option.none() });

  return Layer.merge(adsTestWith(meters), meters);
})();

layer(BillingTest, { excludeTestServices: true })(
  "Google Ads accounts",
  (it) => {
    it.effect(
      "connect directly or through their manager, and may never spend",
      () =>
        Effect.gen(function* connecting() {
          yield* onGoogle(accounts);
          const owner = yield* freshOwner;
          const connections = yield* AdConnections;

          const { accounts: added, connection } = yield* connected(
            owner,
            ["1111111111", "3333333333"],
            "google"
          );

          assert.deepStrictEqual(
            added.map(({ account }) => [
              account.externalId,
              account.network,
              Option.getOrNull(account.reachedThrough),
            ]),
            [
              ["1111111111", "google", null],
              ["3333333333", "google", "2222222222"],
            ]
          );
          assert.isFalse(connection.maySpend);
          assert.deepStrictEqual(yield* connections.status(owner), {
            mode: "read",
            networks: ["google"],
          });
        })
    );

    it.effect(
      "sign in with PKCE: the code goes back with the verifier of the challenge sent",
      () =>
        Effect.gen(function* pkce() {
          const api = yield* onGoogle(accounts);
          const owner = yield* freshOwner;
          const connections = yield* AdConnections;
          const url = new URL(yield* connections.begin(owner, "google"));

          yield* connections.complete(owner, returnedWith(url.href, "google"));

          const sent = api.requests().find(toToken);

          const verifier = new URLSearchParams(
            sent === undefined ? "" : textOf(sent)
          ).get("code_verifier");

          assert.strictEqual(
            url.searchParams.get("code_challenge_method"),
            "S256"
          );
          assert.isNotNull(verifier);
          assert.strictEqual(
            url.searchParams.get("code_challenge"),
            createHash("sha256")
              .update(verifier ?? "")
              .digest("base64url")
          );
        })
    );

    it.effect(
      "read 90 days the first time, the last 7 after, and again six hours on",
      () =>
        Effect.gen(function* reading() {
          const api = yield* onGoogle(accounts);
          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;

          const { account } = yield* connectedGoogle(owner, "3333333333");

          // The sweep scheduled ten minutes ago reaches the account now:
          // its next read is due at the sweep six hours on, not six hours
          // from now, which that sweep would miss by ten minutes.
          const runAt = DateTime.subtract(yield* DateTime.now, { minutes: 10 });

          assert.strictEqual(
            yield* sync.run(account.id, Option.some(runAt)),
            "synced"
          );
          assert.isFalse(yield* due(account, "5 hours"));
          assert.isTrue(
            yield* dueAt(account, DateTime.add(runAt, { hours: 6 }))
          );
          assert.strictEqual(
            yield* sync.run(account.id, Option.none()),
            "synced"
          );
          assert.deepStrictEqual(
            daysAsked(api.requests(), "3333333333"),
            [90, 7]
          );
        })
    );

    it.effect(
      "report each campaign's days, with no ad, no reach and no results, and claim no managed ad",
      () =>
        Effect.gen(function* reporting() {
          const api = yield* onGoogle({
            ...accounts,
            days: [
              // 100.0001 cents each day: 200.0002 in all, which is 201 cents
              // rounded once, where two rounded days would make 202.
              day(yield* dayAgo(1), { costMicros: "1000001" }),
              day(yield* dayAgo(2), { costMicros: "1000001" }),
              day(yield* dayAgo(2), { campaignId: "902", clicks: undefined }),
              // Before what the first read asks.
              day(yield* dayAgo(120)),
            ],
          });

          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const reports = yield* AdReports;
          const { account } = yield* connectedGoogle(owner);
          const accountId = account.id;

          assert.strictEqual(yield* sync.run(accountId), "synced");
          assert.isAbove(api.requests().length, 0);

          const campaigns = yield* reports.campaigns(owner, accountId, noRange);

          assert.deepStrictEqual(
            campaigns.rows.map((row) => [
              row.externalId,
              row.name,
              row.status,
              Option.getOrNull(row.kind),
              Option.getOrNull(row.dailyBudget),
              row.totals.spend,
              row.totals.clicks,
              row.totals.impressions,
              row.totals.reach,
              Option.getOrNull(row.totals.results),
            ]),
            [
              [
                "901",
                "Winter sale",
                "active",
                "SEARCH",
                1000,
                201,
                8,
                600,
                0,
                null,
              ],
              [
                "902",
                "Always on",
                "paused",
                "PERFORMANCE_MAX",
                null,
                250,
                0,
                300,
                0,
                null,
              ],
            ]
          );

          const days = yield* reports.days(owner, accountId, noRange);

          assert.deepStrictEqual(
            days.rows.map((row) => [row.spend, row.clicks, row.reach]),
            [
              [351, 4, 0],
              [101, 4, 0],
            ]
          );

          const ads = yield* reports.ads(
            owner,
            accountId,
            Option.none(),
            noRange
          );

          assert.lengthOf(ads.rows, 0);

          const claims = (yield* FakeMetersLedger.use(Ref.get)).claims.filter(
            ({ meter }) => meter === "managedAds"
          );

          assert.lengthOf(claims, 0);
        })
    );

    it.effect(
      "replace the days read, and keep a campaign no longer listed as archived",
      () =>
        Effect.gen(function* rereading() {
          const yesterday = yield* dayAgo(1);
          const before = yield* dayAgo(2);

          const api = yield* onGoogle({
            ...accounts,
            days: [
              day(yesterday),
              day(before),
              day(before, { campaignId: "902", costMicros: "1000000" }),
            ],
          });

          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const reports = yield* AdReports;
          const { account } = yield* connectedGoogle(owner);
          const accountId = account.id;

          yield* sync.run(accountId);

          // Google corrected yesterday to nothing, which it no longer
          // lists, and the second campaign is gone.
          api.forget(
            (row) =>
              !(
                row.campaignId === "901" &&
                "date" in row &&
                row.date === yesterday
              ) && row.id !== "902"
          );

          yield* sync.run(accountId);

          const days = yield* reports.days(owner, accountId, noRange);

          assert.deepStrictEqual(
            days.rows.map((row) => row.spend),
            [350]
          );

          const campaigns = yield* reports.campaigns(owner, accountId, noRange);

          assert.deepStrictEqual(
            campaigns.rows.map((row) => [row.externalId, row.status]),
            [
              ["901", "active"],
              ["902", "archived"],
            ]
          );
        })
    );

    it.effect(
      "leave out of the report a removed campaign that did nothing in its days",
      () =>
        Effect.gen(function* removed() {
          yield* onGoogle({
            ...accounts,
            campaigns: [
              ...(accounts.campaigns ?? []),
              {
                customerId: "1111111111",
                id: "903",
                name: "Removed long ago",
                status: "REMOVED",
              },
              {
                customerId: "1111111111",
                id: "904",
                name: "Removed this week",
                status: "REMOVED",
              },
            ],
            days: [day(yield* dayAgo(2), { campaignId: "904" })],
          });

          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const reports = yield* AdReports;
          const { account } = yield* connectedGoogle(owner);

          yield* sync.run(account.id);

          const campaigns = yield* reports.campaigns(
            owner,
            account.id,
            noRange
          );

          assert.deepStrictEqual(
            campaigns.rows.map(({ externalId }) => externalId).toSorted(),
            ["901", "902", "904"]
          );
        })
    );

    it.effect(
      "refuse spending and boosts before anything is reserved, on a server that spends",
      () =>
        Effect.gen(function* refusing() {
          yield* onGoogle(accounts, "spend");
          const owner = yield* freshOwner;
          const spending = yield* SpendAuthorizations;
          const boosts = yield* Boosts;
          const { account } = yield* connectedGoogle(owner);

          assert.strictEqual(
            yield* tagOf(
              spending.decide(owner, account.id, {
                _tag: "on",
                monthlyCeiling: eur(10_000),
              })
            ),
            "SpendingUnavailable"
          );

          const post = yield* TestPosts.use((posts) =>
            posts.publish(owner.workspaceId)
          );

          const now = yield* DateTime.now;

          assert.strictEqual(
            yield* tagOf(
              boosts.request(
                owner,
                {
                  accountId: account.id,
                  audience: new Audience({
                    ageMax: 65,
                    ageMin: 18,
                    countries: ["US"],
                  }),
                  beneficiary: Option.none(),
                  budget: { _tag: "total", amount: 5000 },
                  channelId: post.channelId,
                  currency: CurrencySchema.make("EUR"),
                  endsAt: DateTime.add(now, { days: 7 }),
                  payer: Option.none(),
                  postId: post.postId,
                  specialAdCategory: "none",
                  startsAt: Option.none(),
                },
                crypto.randomUUID()
              )
            ),
            "AdAccountUnusable"
          );

          assert.lengthOf(
            yield* boosts.list(owner, {
              before: Option.none(),
              postId: Option.none(),
            }),
            0
          );
        })
    );

    it.effect(
      "put off an account Google cannot find, and leave its sign-in working",
      () =>
        Effect.gen(function* notFound() {
          const api = yield* onGoogle(accounts);
          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const connections = yield* AdConnections;
          const { account } = yield* connectedGoogle(owner);

          api.script({
            answer: googleAdsError(
              401,
              "authenticationError",
              "CUSTOMER_NOT_FOUND"
            ),
            when: searching("customer"),
          });

          assert.strictEqual(yield* sync.run(account.id), "postponed");

          const [connection] = yield* connections.list(owner);

          assert.strictEqual(connection?.grant.access, "working");
          assert.deepStrictEqual(
            yield* TestNetworks.use((networks) =>
              networks.told(owner.workspaceId)
            ),
            []
          );
        })
    );

    it.effect(
      "find the new way to an account whose manager no longer reaches it, and read through it",
      () =>
        Effect.gen(function* rerouted() {
          const api = yield* onGoogle({
            ...accounts,
            days: [
              day(yield* dayAgo(1), {
                customerId: "3333333333",
                campaignId: "931",
              }),
            ],
          });

          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const store = yield* AccountStore;
          const { account } = yield* connectedGoogle(owner, "3333333333");

          assert.strictEqual(yield* sync.run(account.id), "synced");

          // The agency hands the account over: the person now uses it
          // directly, and the manager no longer holds it.
          api.setClients("2222222222", []);
          api.setAccessible(["1111111111", "2222222222", "3333333333"]);

          assert.strictEqual(yield* sync.run(account.id), "synced");

          const read = yield* store.get(account.id);

          assert.deepStrictEqual(
            read.pipe(
              Option.map(({ account: now }) => [
                Option.getOrNull(now.reachedThrough),
                Option.getOrNull(now.unreachableSince),
              ])
            ),
            Option.some([null, null])
          );
        })
    );

    it.effect(
      "say an account no way reaches any more is unreachable, and keep its days",
      () =>
        Effect.gen(function* unreachable() {
          const api = yield* onGoogle({
            ...accounts,
            days: [
              day(yield* dayAgo(1), {
                customerId: "3333333333",
                campaignId: "931",
              }),
            ],
          });

          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const store = yield* AccountStore;
          const connections = yield* AdConnections;
          const { account } = yield* connectedGoogle(owner, "3333333333");

          yield* sync.run(account.id);
          api.setClients("2222222222", []);

          assert.strictEqual(yield* sync.run(account.id), "postponed");

          const read = yield* store.get(account.id);

          assert.isTrue(
            read.pipe(
              Option.exists(({ account: now }) =>
                Option.isSome(now.unreachableSince)
              )
            )
          );
          assert.strictEqual(yield* campaignDaysOf(owner.workspaceId), 1);

          const [connection] = yield* connections.list(owner);

          assert.strictEqual(connection?.grant.access, "working");
        })
    );

    it.effect(
      "leave the way to another member's account alone when a sign-in lists it",
      () =>
        Effect.gen(function* twoSignIns() {
          const api = yield* onGoogle(accounts);
          const owner = yield* freshOwner;
          const store = yield* AccountStore;
          const { account } = yield* connectedGoogle(owner, "3333333333");

          // Another member, with another Google account, uses the account
          // directly: their sign-in lists it without its manager.
          api.setAccessible(["1111111111", "2222222222", "3333333333"]);
          api.signInAs("109876543210987654322");

          yield* signIn(
            member(
              owner.workspaceId,
              "admin",
              UserIdSchema.make("0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e")
            ),
            "google"
          );

          const read = yield* store.get(account.id);

          assert.deepStrictEqual(
            read.pipe(
              Option.map(({ account: now }) =>
                String(Option.getOrNull(now.reachedThrough))
              )
            ),
            Option.some("2222222222")
          );
        })
    );

    it.effect("take the way Google lists to an account at each listing", () =>
      Effect.gen(function* listing() {
        const api = yield* onGoogle(accounts);
        const owner = yield* freshOwner;
        const store = yield* AccountStore;
        const connections = yield* AdConnections;

        const { account, connection } = yield* connectedGoogle(
          owner,
          "3333333333"
        );

        api.setClients("2222222222", []);
        api.setAccessible(["1111111111", "2222222222", "3333333333"]);
        yield* connections.reachable(owner, connection.grant.id);

        const read = yield* store.get(account.id);

        assert.isTrue(
          read.pipe(
            Option.exists(({ account: now }) =>
              Option.isNone(now.reachedThrough)
            )
          )
        );
      })
    );

    it.effect("mark a refused sign-in once, and tell once", () =>
      Effect.gen(function* refused() {
        const api = yield* onGoogle(accounts);
        const owner = yield* freshOwner;
        const sync = yield* SyncAccount;
        const { account } = yield* connectedGoogle(owner);
        const accountId = account.id;

        for (const _ of [1, 2]) {
          api.script({
            answer: googleAdsError(
              401,
              "authenticationError",
              "OAUTH_TOKEN_REVOKED"
            ),
            when: searching("customer"),
          });
        }

        assert.strictEqual(yield* sync.run(accountId), "reconnectNeeded");
        assert.strictEqual(yield* sync.run(accountId), "reconnectNeeded");

        const told = yield* TestNetworks.use((networks) =>
          networks.told(owner.workspaceId)
        );

        assert.deepStrictEqual(
          told.map(({ news }) => news),
          ["reconnectNeeded"]
        );
      })
    );

    it.effect(
      "leave no campaign day once disconnected, and none past the retention",
      () =>
        Effect.gen(function* removing() {
          yield* onGoogle({
            ...accounts,
            days: [day(yield* dayAgo(1))],
          });

          const owner = yield* freshOwner;
          const sync = yield* SyncAccount;
          const connections = yield* AdConnections;
          const readModel = yield* ReadModel;

          const { account, connection } = yield* connectedGoogle(owner);

          yield* sync.run(account.id);

          assert.strictEqual(yield* campaignDaysOf(owner.workspaceId), 1);

          // The retention's purge reaches campaign days too.
          const now = yield* DateTime.now;

          assert.isAtLeast(
            yield* readModel.purgeDaysBefore(
              utcDayOf(DateTime.add(now, { days: 2 }))
            ),
            1
          );
          assert.strictEqual(yield* campaignDaysOf(owner.workspaceId), 0);

          yield* sync.run(account.id);
          assert.strictEqual(yield* campaignDaysOf(owner.workspaceId), 1);

          yield* connections.disconnect(owner, connection.grant.id);
          assert.strictEqual(yield* campaignDaysOf(owner.workspaceId), 0);
        })
    );
  }
);
