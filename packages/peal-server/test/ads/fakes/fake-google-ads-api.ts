import { setTimeout as sleep } from "node:timers/promises";

import { Effect, Redacted, Schema } from "effect";
import { Base64Url } from "effect/encoding";

import type { GoogleAdsClientSettings } from "#ads/infrastructure/google/google-ads-client.ts";
import type { GoogleAdsEndpoints } from "#ads/infrastructure/google/google-ads-http.ts";
import {
  dropped,
  headerOf,
  json,
  platformServer,
  textOf,
} from "#test/publishing/fakes/platform-server.ts";
import type {
  JsonValue,
  PlatformAnswer,
  PlatformRequest,
} from "#test/publishing/fakes/platform-server.ts";

// A stand-in on loopback for the three Google endpoints the read-only
// Google Ads adapter may call, written from Google's pages (read
// 2026-11-16): the OAuth token endpoint (a code, a refresh), the Google Ads
// API's `customers:listAccessibleCustomers`, and `googleAds:search`, which
// answers by the query's FROM, a page at a time. Every other path answers
// 404 and stays in `requests` for the test to see. It checks the client,
// the refresh token and the access token, and whether `login-customer-id`
// opens the customer asked, and can be told to refuse, slow down or cut
// the connection.

/** Peal's OAuth client at Google, for tests only. */
export const googleAdsSettings: GoogleAdsClientSettings = {
  clientId: "synthetic-client.apps.googleusercontent.com",
  clientSecret: Redacted.make("synthetic-google-ads-secret"),
};

export const googleRefreshToken = "1//synthetic-refresh-token";
export const googleAccessToken = "ya29.synthetic-access-token";

/** The Google account that signs in, as the ID token's `sub` names it. */
export const googleUserId = "109876543210987654321";

export const adwordsScope = "https://www.googleapis.com/auth/adwords";

/** A customer (a Google Ads account), as `customer_client` describes one. */
export interface FakeCustomer {
  /** The client accounts it manages directly, when a manager. */
  readonly clients?: readonly string[];
  readonly currencyCode: string;
  readonly descriptiveName: string;
  readonly id: string;
  readonly manager?: boolean;
  readonly status?: string;
  readonly testAccount?: boolean;
  readonly timeZone: string;
}

/** A campaign row, as the REST answer writes `campaign` and its budget. */
export interface FakeCampaign {
  readonly advertisingChannelType?: string | undefined;
  readonly amountMicros?: string | undefined;
  readonly customerId: string;
  readonly endDateTime?: string | undefined;
  readonly id: string;
  readonly name: string;
  readonly period?: string | undefined;
  readonly startDateTime?: string | undefined;
  readonly status: string;
  readonly totalAmountMicros?: string | undefined;
}

/** A day of a campaign's numbers; Google leaves out a metric at zero. */
export interface FakeCampaignDay {
  readonly campaignId: string;
  readonly clicks?: string | undefined;
  readonly costMicros?: string | undefined;
  readonly customerId: string;
  readonly date: string;
  readonly impressions?: string | undefined;
}

export interface FakeGoogleAdsOptions {
  /** The customers the person is a direct user of. */
  readonly accessible?: readonly string[];
  readonly campaigns?: readonly FakeCampaign[];
  readonly customers?: readonly FakeCustomer[];
  readonly days?: readonly FakeCampaignDay[];
  /** The scopes the token endpoint says were granted. */
  readonly granted?: readonly string[];
  /** Rows a page of `googleAds:search` holds; Google's is 10,000. */
  readonly pageSize?: number;
  /** Whether the code's exchange answers a refresh token. */
  readonly refreshToken?: boolean;
}

/**
 * What to do with the next request that matches, once: an answer sent
 * instead of handling it, `dropped` (the connection cut), or `slow` (the
 * request handled after `delayMs`).
 */
export interface GoogleScripted {
  readonly answer: PlatformAnswer | "dropped" | { readonly delayMs: number };
  readonly when: (request: PlatformRequest) => boolean;
}

const statusNames = {
  400: "INVALID_ARGUMENT",
  401: "UNAUTHENTICATED",
  403: "PERMISSION_DENIED",
  429: "RESOURCE_EXHAUSTED",
  500: "INTERNAL",
} as const;

// A JSON object of the fields given, without those left undefined, as
// protocol buffers' JSON mapping leaves out a field at its default.
const present = (
  fields: readonly (readonly [string, JsonValue | undefined])[]
): JsonValue =>
  Object.fromEntries(
    fields.flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value] as const]
    )
  );

/**
 * A Google Ads API refusal as REST writes it: a Status in `error`, its
 * GoogleAdsFailure in `details`, with one error of `key` and `value`, a
 * message that quotes what was sent, and the quota's `retryDelay` when
 * given ("Understand API errors", QuotaErrorDetails).
 */
export const googleAdsError = (
  status: keyof typeof statusNames,
  key: string,
  value: string,
  retryDelay?: string
): PlatformAnswer =>
  json(
    {
      error: {
        code: status,
        details: [
          {
            "@type":
              "type.googleapis.com/google.ads.googleads.v26.errors.GoogleAdsFailure",
            errors: [
              present([
                ["errorCode", { [key]: value }],
                ["message", "synthetic message quoting SELECT campaign.name"],
                [
                  "details",
                  retryDelay === undefined
                    ? undefined
                    : { quotaErrorDetails: { retryDelay } },
                ],
              ]),
            ],
            requestId: "synthetic-request-id",
          },
        ],
        message: "synthetic message quoting SELECT campaign.name",
        status: statusNames[status],
      },
    },
    status
  );

/** The token endpoint's refusal (RFC 6749, 5.2). */
export const oauthError = (error: string, status = 400): PlatformAnswer =>
  json({ error, error_description: "synthetic" }, status);

/** An unsigned ID token naming `sub`, as the token endpoint returns one. */
const idTokenOf = (sub: string) =>
  [
    Base64Url.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    Base64Url.encode(
      JSON.stringify({
        aud: googleAdsSettings.clientId,
        iss: "https://accounts.google.com",
        sub,
      })
    ),
    "synthetic-signature",
  ].join(".");

const SearchBodySchema = Schema.Struct({
  pageToken: Schema.optionalKey(Schema.String),
  query: Schema.String,
});

const decodeSearch = Schema.decodeUnknownSync(
  Schema.fromJsonString(SearchBodySchema)
);

const searchPath = /^\/v26\/customers\/(?<customer>\d+)\/googleAds:search$/u;

/** The route a request takes: its method and its path, ids as `*`. */
export const routeOf = (request: PlatformRequest) =>
  `${request.method} ${request.path.replace(searchPath, "/v26/customers/*/googleAds:search")}`;

const pageTokenPattern = /^synthetic-page-(?<page>\d+)$/u;

const clientOk = (form: URLSearchParams) =>
  form.get("client_id") === googleAdsSettings.clientId &&
  form.get("client_secret") === Redacted.value(googleAdsSettings.clientSecret);

const authorized = (request: PlatformRequest) =>
  headerOf(request, "authorization") === `Bearer ${googleAccessToken}`;

const unauthenticated = () =>
  googleAdsError(401, "authenticationError", "OAUTH_TOKEN_INVALID");

const clientRow = ({
  customer,
  level,
}: {
  readonly customer: FakeCustomer;
  readonly level: number;
}): JsonValue => ({
  customerClient: present([
    ["clientCustomer", `customers/${customer.id}`],
    ["currencyCode", customer.currencyCode],
    ["descriptiveName", customer.descriptiveName],
    ["id", customer.id],
    ["level", level === 0 ? undefined : String(level)],
    ["manager", customer.manager === true ? true : undefined],
    ["resourceName", `customers/x/customerClients/${customer.id}`],
    ["status", customer.status ?? "ENABLED"],
    ["testAccount", customer.testAccount === true ? true : undefined],
    ["timeZone", customer.timeZone],
  ]),
});

const customerRow = (found: FakeCustomer): JsonValue => ({
  customer: present([
    ["currencyCode", found.currencyCode],
    ["descriptiveName", found.descriptiveName],
    ["id", found.id],
    ["resourceName", `customers/${found.id}`],
    ["status", found.status ?? "ENABLED"],
    ["testAccount", found.testAccount === true ? true : undefined],
    ["timeZone", found.timeZone],
  ]),
});

const dayRow = (customer: string, day: FakeCampaignDay): JsonValue => ({
  campaign: {
    id: day.campaignId,
    resourceName: `customers/${customer}/campaigns/${day.campaignId}`,
  },
  metrics: present([
    ["clicks", day.clicks],
    ["costMicros", day.costMicros],
    ["impressions", day.impressions],
  ]),
  segments: { date: day.date },
});

const campaignRow = (customer: string, campaign: FakeCampaign): JsonValue => ({
  campaign: present([
    ["advertisingChannelType", campaign.advertisingChannelType],
    ["endDateTime", campaign.endDateTime],
    ["id", campaign.id],
    ["name", campaign.name],
    ["resourceName", `customers/${customer}/campaigns/${campaign.id}`],
    ["startDateTime", campaign.startDateTime],
    ["status", campaign.status],
  ]),
  campaignBudget: present([
    ["amountMicros", campaign.amountMicros],
    ["period", campaign.period],
    ["resourceName", `customers/${customer}/campaignBudgets/9${campaign.id}`],
    ["totalAmountMicros", campaign.totalAmountMicros],
  ]),
});

const between =
  /segments\.date BETWEEN '(?<since>[\d-]+)' AND '(?<until>[\d-]+)'/u;

/** A fake of Google's token endpoint and of the Google Ads API. */
export const fakeGoogleAdsApi = (options: FakeGoogleAdsOptions = {}) =>
  Effect.gen(function* startingGoogleAds() {
    const customers = new Map(
      (options.customers ?? []).map((customer) => [customer.id, customer])
    );

    const accessible = options.accessible ?? [...customers.keys()];
    const scripts: GoogleScripted[] = [];
    const pageSize = options.pageSize ?? 10_000;
    const days: FakeCampaignDay[] = [...(options.days ?? [])];
    const campaigns: FakeCampaign[] = [...(options.campaigns ?? [])];
    let refreshTokens = 0;

    // Every customer under a manager, at any depth, as `customer_client`
    // lists them: the manager itself at level 0.
    const below = (
      id: string,
      level = 0
    ): readonly { customer: FakeCustomer; level: number }[] => {
      const customer = customers.get(id);

      if (customer === undefined) {
        return [];
      }

      return [
        { customer, level },
        ...(customer.clients ?? []).flatMap((client) =>
          below(client, level + 1)
        ),
      ];
    };

    // Whether a request on `customer` through `login` reaches it: as a
    // direct user without the header, or under the manager it names.
    const reaches = (customer: string, login: string) =>
      login === ""
        ? accessible.includes(customer)
        : accessible.includes(login) &&
          below(login).some((entry) => entry.customer.id === customer);

    const token = (request: PlatformRequest): PlatformAnswer => {
      const form = new URLSearchParams(textOf(request));

      if (!clientOk(form)) {
        return oauthError("invalid_client", 401);
      }

      const scope = (options.granted ?? ["openid", adwordsScope]).join(" ");

      if (form.get("grant_type") === "authorization_code") {
        if (form.get("code") !== "good-code") {
          return oauthError("invalid_grant");
        }

        return json(
          present([
            ["access_token", googleAccessToken],
            ["expires_in", 3599],
            ["id_token", idTokenOf(googleUserId)],
            [
              "refresh_token",
              options.refreshToken === false ? undefined : googleRefreshToken,
            ],
            ["scope", scope],
            ["token_type", "Bearer"],
          ])
        );
      }

      if (
        form.get("grant_type") === "refresh_token" &&
        form.get("refresh_token") === googleRefreshToken
      ) {
        refreshTokens += 1;

        return json({
          access_token: googleAccessToken,
          expires_in: 3599,
          scope,
          token_type: "Bearer",
        });
      }

      return oauthError("invalid_grant");
    };

    const listAccessible = (request: PlatformRequest): PlatformAnswer =>
      authorized(request)
        ? json({ resourceNames: accessible.map((id) => `customers/${id}`) })
        : unauthenticated();

    const rowsFor = (customer: string, query: string): readonly JsonValue[] => {
      const from = /FROM\s+(?<resource>\w+)/u.exec(query)?.groups?.["resource"];

      if (from === "customer_client") {
        const enabledOnly = query.includes(
          "customer_client.status = 'ENABLED'"
        );

        return below(customer).flatMap((entry) =>
          enabledOnly && (entry.customer.status ?? "ENABLED") !== "ENABLED"
            ? []
            : [clientRow(entry)]
        );
      }

      if (from === "customer") {
        const found = customers.get(customer);

        return found === undefined ? [] : [customerRow(found)];
      }

      if (from !== "campaign") {
        return [];
      }

      if (query.includes("segments.date")) {
        const range = between.exec(query)?.groups;
        const since = range?.["since"] ?? "";
        const until = range?.["until"] ?? "";

        return days.flatMap((day) =>
          day.customerId === customer && day.date >= since && day.date <= until
            ? [dayRow(customer, day)]
            : []
        );
      }

      return campaigns.flatMap((campaign) =>
        campaign.customerId === customer
          ? [campaignRow(customer, campaign)]
          : []
      );
    };

    const search = (request: PlatformRequest): PlatformAnswer => {
      if (!authorized(request)) {
        return unauthenticated();
      }

      const customer =
        searchPath.exec(request.path)?.groups?.["customer"] ?? "";

      if (!reaches(customer, headerOf(request, "login-customer-id"))) {
        return googleAdsError(
          403,
          "authorizationError",
          "USER_PERMISSION_DENIED"
        );
      }

      const body = decodeSearch(textOf(request));
      const rows = rowsFor(customer, body.query);

      const page = Number(
        pageTokenPattern.exec(body.pageToken ?? "")?.groups?.["page"] ?? "0"
      );

      const shown = rows.slice(page * pageSize, (page + 1) * pageSize);
      const more = rows.length > (page + 1) * pageSize;

      return json(
        present([
          ["fieldMask", "synthetic"],
          ["nextPageToken", more ? `synthetic-page-${page + 1}` : undefined],
          ["results", shown.length === 0 ? undefined : [...shown]],
        ])
      );
    };

    // Only these routes answer; any other is a request the adapter must
    // never send.
    const routes = {
      "GET /v26/customers:listAccessibleCustomers": listAccessible,
      "POST /token": token,
      "POST /v26/customers/*/googleAds:search": search,
    } satisfies Record<string, (request: PlatformRequest) => PlatformAnswer>;

    const isRoute = (route: string): route is keyof typeof routes =>
      Object.hasOwn(routes, route);

    const notFound = json({ error: { code: 404, status: "NOT_FOUND" } }, 404);

    const server = yield* platformServer(async (request) => {
      const index = scripts.findIndex(({ when }) => when(request));
      const [script] = index === -1 ? [] : scripts.splice(index, 1);
      const scripted = script?.answer;

      if (scripted === "dropped") {
        return dropped;
      }

      if (scripted !== undefined && "delayMs" in scripted) {
        await sleep(scripted.delayMs);
      } else if (scripted !== undefined) {
        return scripted;
      }

      const route = routeOf(request);

      return isRoute(route) ? routes[route](request) : notFound;
    });

    const origin = new URL(server.url);

    const endpoints: GoogleAdsEndpoints = {
      api: origin,
      authorization: new URL("/o/oauth2/v2/auth", origin),
      token: new URL("/token", origin),
    };

    return {
      /** Adds campaigns, as made outside Peal. */
      addCampaigns: (rows: readonly FakeCampaign[]) => {
        campaigns.push(...rows);
      },
      /** Adds days of numbers to the account. */
      addDays: (rows: readonly FakeCampaignDay[]) => {
        days.push(...rows);
      },
      /** Forgets the campaigns and days given, as gone at Google. */
      forget: (
        keep: (row: {
          readonly customerId: string;
          readonly id?: string;
          readonly campaignId?: string;
        }) => boolean
      ) => {
        campaigns.splice(0, campaigns.length, ...campaigns.filter(keep));
        days.splice(0, days.length, ...days.filter(keep));
      },
      endpoints,
      /** How many refreshes the token endpoint answered. */
      refreshes: () => refreshTokens,
      requests: server.requests,
      /** Scripts the next request that matches, once. */
      script: (scripted: GoogleScripted) => {
        scripts.push(scripted);
      },
      url: server.url,
    };
  });

/** A request to `googleAds:search` whose query reads from `resource`. */
export const searching =
  (resource: "campaign" | "customer" | "customer_client", days?: boolean) =>
  (request: PlatformRequest) => {
    if (routeOf(request) !== "POST /v26/customers/*/googleAds:search") {
      return false;
    }

    const { query } = decodeSearch(textOf(request));

    return (
      new RegExp(`FROM ${resource}\\b`, "u").test(query) &&
      (days === undefined || query.includes("segments.date") === days)
    );
  };

/** A request to the token endpoint. */
export const toToken = (request: PlatformRequest) =>
  routeOf(request) === "POST /token";
