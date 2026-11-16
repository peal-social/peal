import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Exit, Option, Redacted } from "effect";

import type { ReadFailure } from "#ads/application/ports/ad-network.ts";
import { NetworkObjectIdSchema } from "#ads/domain/ids.ts";
import { CurrencySchema } from "#ads/domain/money.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import {
  adwordsScope,
  googleAdsError,
  googleUserId,
  oauthError,
  routeOf,
  searching,
  toToken,
} from "#test/ads/fakes/fake-google-ads-api.ts";
import type {
  FakeCampaign,
  FakeCustomer,
  FakeGoogleAdsOptions,
} from "#test/ads/fakes/fake-google-ads-api.ts";
import { googleAgainstFake, refreshToken } from "#test/ads/google-client.ts";
import { headerOf, rawJson } from "#test/publishing/fakes/platform-server.ts";

const id = (value: string) => NetworkObjectIdSchema.make(value);

const customer = (
  customerId: string,
  more: Partial<FakeCustomer> = {}
): FakeCustomer => ({
  currencyCode: "EUR",
  descriptiveName: `Example Studio ${customerId}`,
  id: customerId,
  timeZone: "Europe/Paris",
  ...more,
});

// A direct account, a manager with a client, a sub-manager and its client,
// the direct account under the manager too, and one that refuses.
const hierarchy: FakeGoogleAdsOptions = {
  accessible: ["1111111111", "2222222222", "6666666666"],
  customers: [
    customer("1111111111"),
    customer("2222222222", {
      clients: ["3333333333", "4444444444", "1111111111", "7777777777"],
      manager: true,
    }),
    customer("3333333333", { currencyCode: "JPY", timeZone: "Asia/Tokyo" }),
    customer("4444444444", { clients: ["5555555555"], manager: true }),
    customer("5555555555", { descriptiveName: "" }),
    customer("6666666666"),
    customer("7777777777", { status: "CANCELED" }),
  ],
};

const campaign = (more: Partial<FakeCampaign> = {}): FakeCampaign => ({
  advertisingChannelType: "SEARCH",
  amountMicros: "12340000",
  customerId: "1111111111",
  endDateTime: "2026-12-31 23:59:59",
  id: "901",
  name: "Winter sale",
  period: "DAILY",
  startDateTime: "2026-11-01 00:00:00",
  status: "ENABLED",
  ...more,
});

const request = (
  externalId: string,
  more: { currency?: string; reachedThrough?: string; timeZone?: string } = {}
) => ({
  currency: CurrencySchema.make(more.currency ?? "EUR"),
  externalId: id(externalId),
  reachedThrough: Option.fromUndefinedOr(more.reachedThrough).pipe(
    Option.map(id)
  ),
  since: { day: 1, month: 11, year: 2026 },
  timeZone: TimeZoneIdSchema.make(more.timeZone ?? "Europe/Paris"),
  until: { day: 10, month: 11, year: 2026 },
});

const failureOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit) ? exit.cause.reasons[0] : undefined;

const errorOf = <A, E>(exit: Exit.Exit<A, E>) => {
  const reason = failureOf(exit);

  return reason !== undefined && reason._tag === "Fail"
    ? reason.error
    : undefined;
};

describe("signing in to Google Ads", () => {
  it.live(
    "sends the browser to Google's consent page, offline, for adwords",
    () =>
      Effect.gen(function* signingIn() {
        const { client } = yield* googleAgainstFake();
        const url = new URL(client.authorizationUrl("synthetic-state"));

        assert.strictEqual(url.pathname, "/o/oauth2/v2/auth");
        assert.strictEqual(
          url.search,
          `?${new URLSearchParams({
            access_type: "offline",
            client_id: "synthetic-client.apps.googleusercontent.com",
            include_granted_scopes: "false",
            prompt: "consent",
            redirect_uri: "https://peal.example/connect/ads/google/callback",
            response_type: "code",
            scope: `openid ${adwordsScope}`,
            state: "synthetic-state",
          }).toString()}`
        );
        assert.strictEqual(client.network, "google");
        assert.isFalse(client.maySpend([adwordsScope]));
      }).pipe(Effect.scoped)
  );

  it.live(
    "holds the refresh token, the account's sub and the scopes granted",
    () =>
      Effect.gen(function* completing() {
        const { client } = yield* googleAgainstFake();
        const grant = yield* client.complete("good-code");

        assert.strictEqual(grant.platformUserId, googleUserId);
        assert.strictEqual(
          Redacted.value(grant.token),
          Redacted.value(refreshToken)
        );
        assert.deepStrictEqual(grant.scopes, ["openid", adwordsScope]);
        assert.isTrue(Option.isNone(grant.expiresAt));
      }).pipe(Effect.scoped)
  );

  it.live("is denied without a refresh token, or without adwords", () =>
    Effect.gen(function* denied() {
      for (const options of [
        { refreshToken: false },
        { granted: ["openid"] },
      ] satisfies FakeGoogleAdsOptions[]) {
        const { client } = yield* googleAgainstFake(options);
        const exit = yield* Effect.exit(client.complete("good-code"));

        assert.deepInclude(errorOf(exit), {
          _tag: "AdSignInFailed",
          reason: "denied",
        });
      }
    }).pipe(Effect.scoped)
  );

  it.live(
    "fails on a code Google refuses, and waits on Google not answering",
    () =>
      Effect.gen(function* refused() {
        const { api, client } = yield* googleAgainstFake();

        assert.deepInclude(
          errorOf(yield* Effect.exit(client.complete("bad-code"))),
          {
            _tag: "AdSignInFailed",
            reason: "failed",
          }
        );

        api.script({ answer: "dropped", when: toToken });

        assert.deepInclude(
          errorOf(yield* Effect.exit(client.complete("good-code"))),
          { _tag: "PlatformUnavailable" }
        );
      }).pipe(Effect.scoped)
  );
});

describe("the accounts a Google sign-in reaches", () => {
  it.live(
    "lists direct accounts first, then each manager's clients through it, once each",
    () =>
      Effect.gen(function* listing() {
        const { api, client } = yield* googleAgainstFake(hierarchy);

        api.script({
          answer: googleAdsError(
            403,
            "authorizationError",
            "CUSTOMER_NOT_ENABLED"
          ),
          when: (sent) =>
            searching("customer_client")(sent) &&
            sent.path.includes("/6666666666/"),
        });

        const accounts = yield* client.accounts(refreshToken);

        assert.deepStrictEqual(
          accounts.map((account) => [
            account.externalId,
            Option.getOrNull(account.reachedThrough),
            account.name,
            account.currency,
            Option.getOrNull(account.timeZone),
            account.status,
          ]),
          [
            [
              "1111111111",
              null,
              "Example Studio 1111111111",
              "EUR",
              "Europe/Paris",
              "active",
            ],
            [
              "3333333333",
              "2222222222",
              "Example Studio 3333333333",
              "JPY",
              "Asia/Tokyo",
              "active",
            ],
            [
              "5555555555",
              "2222222222",
              "Account 5555555555",
              "EUR",
              "Europe/Paris",
              "active",
            ],
          ]
        );

        const listings = api
          .requests()
          .filter(
            (sent) =>
              routeOf(sent) === "GET /v26/customers:listAccessibleCustomers"
          );

        assert.deepStrictEqual(
          listings.map((sent) => headerOf(sent, "login-customer-id")),
          [""]
        );

        // Each accessible customer is read as itself.
        for (const sent of api
          .requests()
          .filter(searching("customer_client"))) {
          assert.include(sent.path, `/${headerOf(sent, "login-customer-id")}/`);
        }

        // One access token for the whole listing.
        assert.strictEqual(api.refreshes(), 1);
      }).pipe(Effect.scoped)
  );

  it.live(
    "leaves out a manager that asks for 2-step verification, and lists nothing for a person without Google Ads",
    () =>
      Effect.gen(function* refusing() {
        const { api, client } = yield* googleAgainstFake(hierarchy);

        api.script({
          answer: googleAdsError(
            401,
            "authenticationError",
            "TWO_STEP_VERIFICATION_NOT_ENROLLED"
          ),
          when: (sent) =>
            searching("customer_client")(sent) &&
            sent.path.includes("/2222222222/"),
        });

        assert.deepStrictEqual(
          (yield* client.accounts(refreshToken)).map(
            ({ externalId }) => externalId
          ),
          ["1111111111", "6666666666"]
        );

        api.script({
          answer: googleAdsError(401, "authenticationError", "NOT_ADS_USER"),
          when: (sent) =>
            routeOf(sent) === "GET /v26/customers:listAccessibleCustomers",
        });

        assert.deepStrictEqual(yield* client.accounts(refreshToken), []);
      }).pipe(Effect.scoped)
  );

  it.live(
    "finds each manager's own row however many pages its clients take",
    () =>
      Effect.gen(function* paging() {
        const { client } = yield* googleAgainstFake({
          ...hierarchy,
          pageSize: 1,
        });

        assert.deepStrictEqual(
          (yield* client.accounts(refreshToken)).map(
            ({ externalId }) => externalId
          ),
          ["1111111111", "6666666666", "3333333333", "5555555555"]
        );
      }).pipe(Effect.scoped)
  );

  it.live("lists 2,000 clients of a manager at most", () =>
    Effect.gen(function* bounded() {
      const clients = Array.from(
        { length: 2001 },
        (_, index) => `9${String(index).padStart(9, "0")}`
      );

      const { client } = yield* googleAgainstFake({
        accessible: ["2222222222"],
        customers: [
          customer("2222222222", { clients, manager: true }),
          ...clients.map((id) => customer(id)),
        ],
        pageSize: 500,
      });

      assert.lengthOf(yield* client.accounts(refreshToken), 2000);
    }).pipe(Effect.scoped)
  );

  it.live(
    "reads an account through its manager, and a direct one without",
    () =>
      Effect.gen(function* reading() {
        const { api, client } = yield* googleAgainstFake(hierarchy);

        const through = yield* client.account(
          refreshToken,
          id("3333333333"),
          Option.some(id("2222222222"))
        );

        assert.strictEqual(through.currency, "JPY");

        const direct = yield* client.account(
          refreshToken,
          id("1111111111"),
          Option.none()
        );

        assert.strictEqual(direct.name, "Example Studio 1111111111");

        const searches = api.requests().filter(searching("customer"));

        assert.deepStrictEqual(
          searches.map((sent) => headerOf(sent, "login-customer-id")),
          ["2222222222", ""]
        );

        // A client read without its manager is refused by Google.
        const refused = yield* Effect.exit(
          client.account(refreshToken, id("3333333333"), Option.none())
        );

        assert.deepInclude(errorOf(refused), {
          _tag: "AdNetworkRefused",
          code: "google.authorizationError.USER_PERMISSION_DENIED",
          kind: "permission",
        });
      }).pipe(Effect.scoped)
  );
});

describe("reading a Google Ads account", () => {
  it.live(
    "reads its campaigns and their days to the last page, in minor units",
    () =>
      Effect.gen(function* reading() {
        const { api, client } = yield* googleAgainstFake({
          ...hierarchy,
          campaigns: [
            campaign(),
            campaign({
              advertisingChannelType: "PERFORMANCE_MAX",
              amountMicros: undefined,
              endDateTime: undefined,
              id: "902",
              name: "Brand\u0000 \uD800always on",
              period: "CUSTOM_PERIOD",
              status: "PAUSED",
              totalAmountMicros: "250000000",
            }),
            campaign({ id: "903", name: "Old", status: "REMOVED" }),
          ],
          days: [
            {
              campaignId: "901",
              clicks: "12",
              costMicros: "12345001",
              customerId: "1111111111",
              date: "2026-11-09",
              impressions: "400",
            },
            {
              campaignId: "901",
              customerId: "1111111111",
              date: "2026-11-10",
              impressions: "3",
            },
            {
              campaignId: "902",
              clicks: "1",
              costMicros: "990000",
              customerId: "1111111111",
              date: "2026-11-10",
            },
            // Outside the days asked.
            {
              campaignId: "901",
              clicks: "1",
              customerId: "1111111111",
              date: "2026-10-31",
            },
          ],
          pageSize: 2,
        });

        const snapshot = yield* client.snapshot(
          refreshToken,
          request("1111111111")
        );

        assert.isTrue(snapshot.complete);
        assert.isTrue(Option.isNone(snapshot.haltedFor));
        assert.deepStrictEqual(
          [snapshot.ads, snapshot.adSets, snapshot.insights],
          [[], [], []]
        );
        assert.strictEqual(
          Option.getOrThrow(snapshot.facts).externalId,
          "1111111111"
        );

        assert.deepStrictEqual(
          snapshot.campaigns.map((read) => [
            read.externalId,
            read.name,
            read.status,
            read.rawStatus,
            Option.getOrNull(read.kind),
            read.objective,
            Option.getOrNull(read.dailyBudget),
            Option.getOrNull(read.totalBudget),
          ]),
          [
            [
              "901",
              "Winter sale",
              "active",
              "ENABLED",
              "SEARCH",
              "other",
              1234,
              null,
            ],
            [
              "902",
              "Brand �always on",
              "paused",
              "PAUSED",
              "PERFORMANCE_MAX",
              "other",
              null,
              25_000,
            ],
            ["903", "Old", "deleted", "REMOVED", "SEARCH", "other", 1234, null],
          ]
        );

        const [first] = snapshot.campaigns;

        // On the account's own clock: midnight in Paris is 23:00 UTC before.
        assert.deepStrictEqual(
          [first?.startsAt, first?.endsAt].map((at) =>
            Option.getOrNull(
              (at ?? Option.none()).pipe(
                Option.map((instant) => DateTime.formatIso(instant))
              )
            )
          ),
          ["2026-10-31T23:00:00.000Z", "2026-12-31T22:59:59.000Z"]
        );

        assert.deepStrictEqual(
          snapshot.campaignDays.map((day) => [
            day.campaignExternalId,
            day.day,
            day.clicks,
            day.impressions,
            day.spend,
          ]),
          [
            ["901", { day: 9, month: 11, year: 2026 }, 12, 400, 1235],
            ["901", { day: 10, month: 11, year: 2026 }, 0, 3, 0],
            ["902", { day: 10, month: 11, year: 2026 }, 1, 0, 99],
          ]
        );

        assert.deepStrictEqual(
          snapshot.campaignDaysCover,
          Option.some({
            from: { day: 1, month: 11, year: 2026 },
            to: { day: 10, month: 11, year: 2026 },
          })
        );

        // Three searches, the campaigns' and the days' over two pages each.
        const searches = api
          .requests()
          .filter(
            (sent) => routeOf(sent) === "POST /v26/customers/*/googleAds:search"
          );

        assert.lengthOf(searches, 5);
        assert.strictEqual(api.refreshes(), 1);
      }).pipe(Effect.scoped)
  );

  it.live("counts yen in whole units, through the manager", () =>
    Effect.gen(function* yen() {
      const { api, client } = yield* googleAgainstFake({
        ...hierarchy,
        campaigns: [
          campaign({ amountMicros: "5000000", customerId: "3333333333" }),
        ],
        days: [
          {
            campaignId: "901",
            costMicros: "5000001",
            customerId: "3333333333",
            date: "2026-11-10",
          },
        ],
      });

      const snapshot = yield* client.snapshot(
        refreshToken,
        request("3333333333", {
          currency: "JPY",
          reachedThrough: "2222222222",
          timeZone: "Asia/Tokyo",
        })
      );

      assert.deepStrictEqual(
        snapshot.campaigns.map(({ dailyBudget }) =>
          Option.getOrNull(dailyBudget)
        ),
        [5]
      );
      assert.strictEqual(snapshot.campaignDays[0]?.spend, 6);

      for (const sent of api.requests().filter(searching("campaign"))) {
        assert.strictEqual(headerOf(sent, "login-customer-id"), "2222222222");
      }
    }).pipe(Effect.scoped)
  );

  it.live("drops a day whose count Peal cannot keep", () =>
    Effect.gen(function* dropping() {
      const { client } = yield* googleAgainstFake({
        ...hierarchy,
        campaigns: [campaign()],
        days: [
          {
            campaignId: "901",
            customerId: "1111111111",
            date: "2026-11-09",
            impressions: "2147483648",
          },
          {
            campaignId: "901",
            clicks: "2",
            customerId: "1111111111",
            date: "2026-11-10",
          },
        ],
      });

      const snapshot = yield* client.snapshot(
        refreshToken,
        request("1111111111")
      );

      assert.deepStrictEqual(
        snapshot.campaignDays.map(({ day }) => day.day),
        [10]
      );
    }).pipe(Effect.scoped)
  );

  it.live(
    "keeps what it read when Google asks to wait, and says how long",
    () =>
      Effect.gen(function* halted() {
        const { api, client } = yield* googleAgainstFake({
          ...hierarchy,
          campaigns: [campaign()],
        });

        api.script({
          answer: googleAdsError(
            429,
            "quotaError",
            "RESOURCE_TEMPORARILY_EXHAUSTED",
            "30s"
          ),
          when: searching("campaign", true),
        });

        const snapshot = yield* client.snapshot(
          refreshToken,
          request("1111111111")
        );

        assert.lengthOf(snapshot.campaigns, 1);
        assert.isTrue(snapshot.complete);
        assert.isTrue(Option.isNone(snapshot.campaignDaysCover));
        assert.deepStrictEqual(
          snapshot.haltedFor.pipe(Option.map(Duration.toSeconds)),
          Option.some(30)
        );
      }).pipe(Effect.scoped)
  );
});

// A failure in one line: its tag, and what the code that acts on it reads.
const summaryOf = (failure: ReadFailure | undefined) => {
  if (failure?._tag === "AdNetworkRefused") {
    return `${failure._tag} ${failure.code} ${failure.kind}`;
  }

  if (failure?._tag === "RateLimited") {
    return `${failure._tag} ${Duration.toSeconds(failure.retryAfter ?? Duration.zero)}`;
  }

  return failure?._tag;
};

describe("Google's refusals", () => {
  const cases = [
    [
      googleAdsError(401, "authenticationError", "OAUTH_TOKEN_REVOKED"),
      "TokenRejected",
    ],
    [
      googleAdsError(401, "authenticationError", "OAUTH_TOKEN_EXPIRED"),
      "TokenRejected",
    ],
    [
      googleAdsError(401, "authenticationError", "GOOGLE_ACCOUNT_DELETED"),
      "TokenRejected",
    ],
    // Not about the token: the person, or one account, cannot be read.
    [
      googleAdsError(401, "authenticationError", "NOT_ADS_USER"),
      "AdNetworkRefused google.authenticationError.NOT_ADS_USER accountUnusable",
    ],
    [
      googleAdsError(401, "authenticationError", "CUSTOMER_NOT_FOUND"),
      "AdNetworkRefused google.authenticationError.CUSTOMER_NOT_FOUND accountUnusable",
    ],
    [
      googleAdsError(
        401,
        "authenticationError",
        "ADVANCED_PROTECTION_NOT_ENROLLED"
      ),
      "AdNetworkRefused google.authenticationError.ADVANCED_PROTECTION_NOT_ENROLLED permission",
    ],
    [
      googleAdsError(
        429,
        "quotaError",
        "RESOURCE_TEMPORARILY_EXHAUSTED",
        "12s"
      ),
      "RateLimited 12",
    ],
    [
      googleAdsError(429, "quotaError", "RESOURCE_EXHAUSTED"),
      "RateLimited 21600",
    ],
    [
      googleAdsError(403, "authorizationError", "USER_PERMISSION_DENIED"),
      "AdNetworkRefused google.authorizationError.USER_PERMISSION_DENIED permission",
    ],
    [
      googleAdsError(
        401,
        "authenticationError",
        "TWO_STEP_VERIFICATION_NOT_ENROLLED"
      ),
      "AdNetworkRefused google.authenticationError.TWO_STEP_VERIFICATION_NOT_ENROLLED permission",
    ],
    [
      googleAdsError(403, "authorizationError", "CUSTOMER_NOT_ENABLED"),
      "AdNetworkRefused google.authorizationError.CUSTOMER_NOT_ENABLED accountUnusable",
    ],
    [
      googleAdsError(
        403,
        "authorizationError",
        "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION"
      ),
      "AdNetworkRefused google.authorizationError.CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION other",
    ],
    [
      googleAdsError(400, "queryError", "UNRECOGNIZED_FIELD"),
      "AdNetworkRefused google.queryError.UNRECOGNIZED_FIELD other",
    ],
    [
      googleAdsError(500, "internalError", "INTERNAL_ERROR"),
      "PlatformUnavailable",
    ],
    ["dropped", "PlatformUnavailable"],
  ] as const;

  it.live.each(cases)("reads %j as its failure", ([answer, expected]) =>
    Effect.gen(function* refused() {
      const { api, client } = yield* googleAgainstFake(hierarchy);

      api.script({ answer, when: searching("customer") });

      const exit = yield* Effect.exit(
        client.account(refreshToken, id("1111111111"), Option.none())
      );

      assert.strictEqual(summaryOf(errorOf(exit)), expected);
    }).pipe(Effect.scoped)
  );

  it.live(
    "reads a refresh token Google no longer takes as rejected, and its client's as the operator's",
    () =>
      Effect.gen(function* refreshing() {
        const { api, client } = yield* googleAgainstFake(hierarchy);

        api.script({ answer: oauthError("invalid_grant"), when: toToken });

        assert.deepInclude(
          errorOf(yield* Effect.exit(client.accounts(refreshToken))),
          {
            _tag: "TokenRejected",
          }
        );

        api.script({
          answer: oauthError("invalid_client", 401),
          when: toToken,
        });

        assert.deepInclude(
          errorOf(yield* Effect.exit(client.accounts(refreshToken))),
          {
            _tag: "PlatformUnavailable",
          }
        );
      }).pipe(Effect.scoped)
  );
});

describe("the token endpoint's other refusals", () => {
  it.live(
    "are Google unavailable, never a rejected token: only invalid_grant rejects one",
    () =>
      Effect.gen(function* refreshing() {
        const { api, client } = yield* googleAgainstFake(hierarchy);

        for (const answer of [
          oauthError("invalid_request"),
          oauthError("invalid_scope"),
          oauthError("access_denied", 403),
          rawJson("<html>Forbidden</html>", 403),
        ]) {
          api.script({ answer, when: toToken });

          assert.deepInclude(
            errorOf(yield* Effect.exit(client.accounts(refreshToken))),
            { _tag: "PlatformUnavailable" }
          );
        }

        api.script({ answer: oauthError("invalid_request"), when: toToken });

        assert.deepInclude(
          errorOf(yield* Effect.exit(client.complete("good-code"))),
          { _tag: "PlatformUnavailable" }
        );
      }).pipe(Effect.scoped)
  );
});

describe("the adapter reads, and writes nothing", () => {
  it.live(
    "refuses to make or run anything, and sends nothing but its three reads",
    () =>
      Effect.gen(function* readOnly() {
        const { api, client } = yield* googleAgainstFake({
          ...hierarchy,
          campaigns: [campaign()],
        });

        yield* client.complete("good-code");
        yield* client.accounts(refreshToken);
        yield* client.account(refreshToken, id("1111111111"), Option.none());
        yield* client.snapshot(refreshToken, request("1111111111"));

        const created = yield* Effect.exit(
          client.create(refreshToken, id("1111111111"), {
            _tag: "campaign",
            name: "Peal boost b1",
          })
        );

        assert.deepInclude(errorOf(created), {
          _tag: "AdNetworkRefused",
          code: "readOnly",
        });

        const ran = yield* Effect.exit(
          client.setRunning(refreshToken, id("901"), true)
        );

        assert.deepInclude(errorOf(ran), {
          _tag: "AdNetworkRefused",
          code: "readOnly",
        });

        assert.deepStrictEqual(
          yield* client.find(refreshToken, id("1111111111"), {
            _tag: "campaign",
            name: "Peal boost b1",
          }),
          { _tag: "unknown" }
        );
        assert.deepStrictEqual(
          yield* client.isRunning(refreshToken, id("901")),
          {
            _tag: "unknown",
          }
        );

        const allowed = new Set([
          "POST /token",
          "GET /v26/customers:listAccessibleCustomers",
          "POST /v26/customers/*/googleAds:search",
        ]);

        const sent = api.requests();

        assert.isAbove(sent.length, 5);

        for (const each of sent) {
          assert.isTrue(allowed.has(routeOf(each)), routeOf(each));
          assert.notInclude(each.path, ":mutate");
          // No developer token: Google retired them on 9 September 2026.
          assert.strictEqual(headerOf(each, "developer-token"), "");
        }
      }).pipe(Effect.scoped)
  );
});
