import { Duration, Effect, Option, Redacted, Result, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import { AdNetworkRefused } from "#ads/application/ad-network-refused.ts";
import { AdSignInFailed } from "#ads/application/ad-sign-in-failed.ts";
import type {
  AdNetworkClient,
  LookUp,
  ReadFailure,
} from "#ads/application/ports/ad-network.ts";
import type { AdAccountFacts } from "#ads/domain/ad-account-facts.ts";
import type { NetworkObjectId } from "#ads/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import type { LocalDate } from "#shared/domain/wall-clock.ts";
import { googleAdsCallbackPath } from "#shared/infrastructure/platforms/google-ads-paths.ts";

import { googleAdsApiVersion, read, withAccess } from "./google-ads-http.ts";
import type { GoogleAdsEndpoints, GoogleAdsHttp } from "./google-ads-http.ts";
import {
  campaignDayOf,
  campaignOf,
  clientFactsOf,
  customerFactsOf,
  customerIdOf,
  levelOf,
} from "./google-ads-mapping.ts";
import {
  AccessibleSchema,
  CampaignRowSchema,
  ClientRowSchema,
  CustomerRowSchema,
  DayRowSchema,
  IdTokenClaimsSchema,
  OAuthErrorSchema,
  pageOf,
  TokenAnswerSchema,
} from "./google-ads-schemas.ts";

/** The operator's OAuth client for Google Ads, in its Cloud project. */
export interface GoogleAdsClientSettings {
  readonly clientId: string;
  readonly clientSecret: Redacted.Redacted;
}

/**
 * The scope the Google Ads API takes ("OAuth multi-user authentication",
 * read 2026-11-16): "See, edit, create, and delete your Google Ads accounts
 * and data". There is no read-only scope: Peal holds a token that could
 * write, and the adapter writes nothing.
 */
export const adwordsScope = "https://www.googleapis.com/auth/adwords";

// The bounds of a listing: the accessible customers a person has, the
// clients of one manager, and the pages of one search (10,000 rows each,
// as Meta's listings are bounded at 40 pages).
const maxAccessible = 50;
const maxClients = 2000;
const maxPages = 40;

// Errors that name Peal's client rather than the person's refresh token:
// the operator's settings are wrong, and no grant is blamed for it (RFC
// 6749, 5.2).
const clientErrors: ReadonlySet<string> = new Set([
  "invalid_client",
  "unauthorized_client",
]);

const dayText = ({ day, month, year }: LocalDate) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

// GAQL of v26 (field references, read 2026-11-16). `customer_client`
// lists a manager's every descendant and the manager itself at level 0
// ("Get account hierarchy"); `test_account` says which are test accounts.
const clientsQuery = `SELECT customer_client.client_customer, customer_client.level, customer_client.manager, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.id, customer_client.status, customer_client.test_account FROM customer_client WHERE customer_client.status = 'ENABLED' LIMIT ${maxClients + 1}`;

const customerQuery =
  "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status, customer.test_account FROM customer";

// Removed campaigns too, so their days keep a name. `start_date_time` and
// `end_date_time` replace v26's former dates; the budget is the
// campaign's attributed `campaign_budget`.
const campaignsQuery =
  "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date_time, campaign.end_date_time, campaign_budget.amount_micros, campaign_budget.period, campaign_budget.total_amount_micros FROM campaign";

// Segmented by day, on the serving account's calendar ("Date ranges"): a
// day whose selected metrics are all zero is not returned ("Zero
// metrics").
const daysQuery = (since: LocalDate, until: LocalDate) =>
  `SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${dayText(since)}' AND '${dayText(until)}'`;

const decodeClaims = Schema.decodeUnknownOption(
  Schema.fromJsonString(IdTokenClaimsSchema)
);

/**
 * The `sub` of the ID token the token endpoint returned, decoded and not
 * verified again: it came from Google over TLS in answer to Peal's own
 * request, which OpenID Connect Core 1.0 (3.1.3.7) allows in place of
 * checking its signature.
 */
const subjectOf = (idToken: string | undefined): Option.Option<string> =>
  Option.fromNullishOr(idToken?.split(".")[1]).pipe(
    Option.flatMap((payload) =>
      Result.match(Base64Url.decodeString(payload), {
        onFailure: () => Option.none<string>(),
        onSuccess: (text) => Option.some(text),
      })
    ),
    Option.flatMap(decodeClaims),
    Option.map(({ sub }) => sub)
  );

/** What a page-by-page search read, and whether it went to its end. */
interface Searched<A> {
  readonly complete: boolean;
  readonly halted: Option.Option<Duration.Duration>;
  readonly rows: readonly A[];
}

const absentLookUp: LookUp<never> = { _tag: "unknown" };

// What the token endpoint's refusal means: Peal's client, which only
// the operator can fix; otherwise the refresh token (revoked, unused six
// months, past the seven days of a consent screen in Testing, or past
// the hundred a Google account may hold), which only a new sign-in
// replaces.
const tokenRefused = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<never, PlatformUnavailable | TokenRejected> =>
  HttpClientResponse.schemaBodyJson(OAuthErrorSchema)(response).pipe(
    Effect.map(({ error }) => error ?? ""),
    Effect.orElseSucceed(() => ""),
    Effect.flatMap(
      (code): Effect.Effect<never, PlatformUnavailable | TokenRejected> => {
        if (clientErrors.has(code)) {
          return Effect.logError(
            "Google refused Peal's Google Ads client: check GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET"
          ).pipe(
            Effect.annotateLogs({ code }),
            Effect.andThen(Effect.fail(new PlatformUnavailable()))
          );
        }

        return response.status >= 500 || response.status === 429
          ? Effect.fail(new PlatformUnavailable())
          : Effect.fail(new TokenRejected());
      }
    )
  );

// A later step of a read that Google asks to wait: what was read is
// kept, and the wait passed on.
const unlessLimited = <A>(
  step: Effect.Effect<Searched<A>, ReadFailure>
): Effect.Effect<Searched<A>, ReadFailure> =>
  step.pipe(
    Effect.catchTag("RateLimited", (limited) =>
      Effect.succeed<Searched<A>>({
        complete: false,
        halted: Option.some(limited.retryAfter ?? Duration.minutes(15)),
        rows: [],
      })
    )
  );

const readOnly = () =>
  Effect.fail(new AdNetworkRefused({ code: "readOnly", kind: "other" }));

/**
 * Google Ads, read only: the sign-in (Google's OAuth 2.0 for web server
 * applications, offline, with the `adwords` scope), the accessible
 * accounts and the clients of the managers among them, and each account's
 * campaigns and daily cost, impressions and clicks through `googleAds:
 * search`. Nothing is ever written: making or running an object is
 * refused before any request, and no request but those three ever leaves
 * (a test lists them).
 *
 * The grant's token is the person's refresh token. Each call trades it
 * for an access token, kept for that call only and never stored.
 */
export const googleAdsClient = (options: {
  readonly endpoints: GoogleAdsEndpoints;
  readonly http: GoogleAdsHttp;
  readonly publicUrl: string;
  readonly settings: GoogleAdsClientSettings;
}): AdNetworkClient => {
  const { endpoints, http, settings } = options;
  const redirectUri = new URL(googleAdsCallbackPath, options.publicUrl).href;

  const tokenRequest = (params: Readonly<Record<string, string>>) =>
    HttpClientRequest.post(endpoints.token).pipe(
      HttpClientRequest.bodyUrlParams({
        ...params,
        client_id: settings.clientId,
        client_secret: Redacted.value(settings.clientSecret),
      })
    );

  const exchanged = (request: HttpClientRequest.HttpClientRequest) =>
    http.execute(request).pipe(
      Effect.catch(() => Effect.fail(new PlatformUnavailable())),
      Effect.flatMap((response) =>
        response.status >= 200 && response.status < 300
          ? HttpClientResponse.schemaBodyJson(TokenAnswerSchema)(response).pipe(
              Effect.mapError(() => new PlatformUnavailable())
            )
          : tokenRefused(response)
      )
    );

  /** A fresh access token for one call, from the grant's refresh token. */
  const accessFor = (refreshToken: Redacted.Redacted) =>
    exchanged(
      tokenRequest({
        grant_type: "refresh_token",
        refresh_token: Redacted.value(refreshToken),
      })
    ).pipe(
      Effect.map(({ access_token: access }) => Redacted.make(access)),
      Effect.withSpan("GoogleAds.access")
    );

  const apiUrl = (path: string) =>
    new URL(`/${googleAdsApiVersion}/${path}`, endpoints.api);

  /**
   * Every row of a query on a customer, a page at a time, until the last
   * page or the bound; Google asking to wait cuts it short and says how
   * long, unless nothing was read yet, which fails.
   */
  const searched = Effect.fn("GoogleAds.search")(function* searched<A, I>(
    access: Redacted.Redacted,
    customer: NetworkObjectId,
    through: Option.Option<NetworkObjectId>,
    query: string,
    row: Schema.Codec<A, I>
  ) {
    const rows: A[] = [];
    let pageToken = Option.none<string>();
    let complete = false;

    for (let page = 0; page < maxPages; page += 1) {
      const request = withAccess(
        HttpClientRequest.post(
          apiUrl(`customers/${customer}/googleAds:search`)
        ).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            query,
            ...Option.match(pageToken, {
              onNone: () => ({}),
              onSome: (token) => ({ pageToken: token }),
            }),
          })
        ),
        access,
        through
      );

      const answer = yield* read(http, request, pageOf(row)).pipe(
        Effect.result
      );

      if (Result.isFailure(answer)) {
        const { failure } = answer;

        if (failure._tag === "RateLimited" && page > 0) {
          const searchedSoFar: Searched<A> = {
            complete: false,
            halted: Option.some(failure.retryAfter ?? Duration.minutes(15)),
            rows,
          };

          return searchedSoFar;
        }

        return yield* Effect.fail(failure);
      }

      rows.push(...(answer.success.results ?? []));
      pageToken = Option.fromUndefinedOr(answer.success.nextPageToken).pipe(
        Option.filter((token) => token !== "")
      );

      if (Option.isNone(pageToken)) {
        complete = true;
        break;
      }
    }

    const all: Searched<A> = { complete, halted: Option.none(), rows };

    return all;
  });

  const accountFacts = (
    access: Redacted.Redacted,
    externalId: NetworkObjectId,
    through: Option.Option<NetworkObjectId>
  ) =>
    searched(
      access,
      externalId,
      through,
      customerQuery,
      CustomerRowSchema
    ).pipe(
      Effect.flatMap(({ rows }) =>
        Effect.fromOption(
          Option.fromUndefinedOr(rows[0]).pipe(
            Option.flatMap((row) => customerFactsOf(row, through))
          )
        ).pipe(
          Effect.mapError(
            () => new AdNetworkRefused({ code: "unreadable", kind: "other" })
          )
        )
      )
    );

  const accounts: AdNetworkClient["accounts"] = Effect.fn("GoogleAds.accounts")(
    function* accounts(token) {
      const access = yield* accessFor(token);

      // "ignores any supplied login-customer-id" ("Listing accessible
      // accounts"): sent without one.
      const listed = yield* read(
        http,
        withAccess(
          HttpClientRequest.get(apiUrl("customers:listAccessibleCustomers")),
          access,
          Option.none()
        ),
        AccessibleSchema
      ).pipe(
        // A Google account with no Google Ads account reaches none: the
        // sign-in works, and offers nothing.
        Effect.catchIf(
          (failure) =>
            failure._tag === "AdNetworkRefused" &&
            failure.code === "google.authenticationError.NOT_ADS_USER",
          () => Effect.succeed<typeof AccessibleSchema.Type>({})
        )
      );

      const ids = (listed.resourceNames ?? []).flatMap((name) =>
        Option.toArray(customerIdOf(name))
      );

      if (ids.length > maxAccessible) {
        yield* Effect.logWarning(
          "A Google sign-in reaches more accounts than Peal lists"
        ).pipe(
          Effect.annotateLogs({ listed: maxAccessible, reached: ids.length })
        );
      }

      const direct: AdAccountFacts[] = [];
      const managed: AdAccountFacts[] = [];

      for (const customer of ids.slice(0, maxAccessible)) {
        // A manager is read as itself: the header names it.
        const listing = yield* searched(
          access,
          customer,
          Option.some(customer),
          clientsQuery,
          ClientRowSchema
        ).pipe(
          Effect.map(Option.some),
          // One customer that refuses is left out; the others are listed.
          Effect.catchTag("AdNetworkRefused", ({ code, kind }) =>
            kind === "permission" || kind === "accountUnusable"
              ? Effect.logInfo("A Google Ads account refused its listing").pipe(
                  Effect.annotateLogs({ code }),
                  Effect.as(
                    Option.none<Searched<typeof ClientRowSchema.Type>>()
                  )
                )
              : Effect.fail(new AdNetworkRefused({ code, kind }))
          )
        );

        if (Option.isNone(listing)) {
          continue;
        }

        const { rows } = listing.value;
        const self = rows.find((row) => levelOf(row) === 0);

        if (self === undefined) {
          continue;
        }

        if (self.customerClient.manager !== true) {
          direct.push(...Option.toArray(clientFactsOf(self, Option.none())));
          continue;
        }

        const clients = rows.filter(
          (row) => levelOf(row) > 0 && row.customerClient.manager !== true
        );

        if (clients.length > maxClients) {
          yield* Effect.logWarning(
            "A Google Ads manager has more clients than Peal lists"
          ).pipe(
            Effect.annotateLogs({ listed: maxClients, reached: clients.length })
          );
        }

        managed.push(
          ...clients
            .slice(0, maxClients)
            .flatMap((row) =>
              Option.toArray(clientFactsOf(row, Option.some(customer)))
            )
        );
      }

      // An account reachable twice is offered once, the direct way first.
      const seen = new Set<string>();

      return [...direct, ...managed].filter((facts) => {
        if (seen.has(facts.externalId)) {
          return false;
        }

        seen.add(facts.externalId);

        return true;
      });
    }
  );

  const account: AdNetworkClient["account"] = (token, externalId, through) =>
    accessFor(token).pipe(
      Effect.flatMap((access) => accountFacts(access, externalId, through)),
      Effect.withSpan("GoogleAds.account")
    );

  const snapshot: AdNetworkClient["snapshot"] = Effect.fn("GoogleAds.snapshot")(
    function* snapshot(token, request) {
      const { currency, externalId, reachedThrough, timeZone } = request;
      const access = yield* accessFor(token);
      const facts = yield* accountFacts(access, externalId, reachedThrough);

      const campaigns = yield* unlessLimited(
        searched(
          access,
          externalId,
          reachedThrough,
          campaignsQuery,
          CampaignRowSchema
        )
      );

      // Asked only when the campaigns were read without a wait.
      const days: Searched<typeof DayRowSchema.Type> = Option.isSome(
        campaigns.halted
      )
        ? { complete: false, halted: Option.none(), rows: [] }
        : yield* unlessLimited(
            searched(
              access,
              externalId,
              reachedThrough,
              daysQuery(request.since, request.until),
              DayRowSchema
            )
          );

      const kept = days.rows.flatMap((row) =>
        Option.toArray(campaignDayOf(row, currency))
      );

      if (kept.length < days.rows.length) {
        yield* Effect.logWarning(
          "Google Ads days Peal cannot keep were left out"
        ).pipe(Effect.annotateLogs({ left: days.rows.length - kept.length }));
      }

      return {
        adSets: [],
        ads: [],
        // A day listed twice is kept once, as last listed.
        campaignDays: [
          ...new Map(
            kept.map(
              (day) =>
                [`${day.campaignExternalId}/${dayText(day.day)}`, day] as const
            )
          ).values(),
        ],
        campaignDaysCover: days.complete
          ? Option.some({ from: request.since, to: request.until })
          : Option.none(),
        campaigns: campaigns.rows.flatMap((row) =>
          Option.toArray(campaignOf(row, currency, timeZone))
        ),
        complete: campaigns.complete,
        facts: Option.some(facts),
        haltedFor: Option.orElse(campaigns.halted, () => days.halted),
        insights: [],
      };
    }
  );

  return {
    account,
    accounts,
    authorizationUrl: (state) => {
      const url = new URL(endpoints.authorization);

      url.search = new URLSearchParams({
        // A refresh token comes only offline, and `consent` has Google
        // give a new one at each sign-in ("Using OAuth 2.0 for Web Server
        // Applications").
        access_type: "offline",
        client_id: settings.clientId,
        include_granted_scopes: "false",
        prompt: "consent",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: ["openid", adwordsScope].join(" "),
        state,
      }).toString();

      return url.href;
    },
    complete: Effect.fn("GoogleAds.complete")(function* complete(code) {
      const answer = yield* exchanged(
        tokenRequest({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        })
      ).pipe(
        Effect.catchTag("TokenRejected", () =>
          Effect.fail(new AdSignInFailed({ reason: "failed" }))
        )
      );

      const scopes = (answer.scope ?? "")
        .split(" ")
        .filter((scope) => scope !== "");

      // Without a refresh token Peal could read nothing later, and without
      // `adwords` nothing at all: the person refused.
      if (
        answer.refresh_token === undefined ||
        // Scopes are compared whole, never as part of a text.
        !new Set(scopes).has(adwordsScope)
      ) {
        return yield* new AdSignInFailed({ reason: "denied" });
      }

      const subject = subjectOf(answer.id_token);

      if (Option.isNone(subject)) {
        return yield* new AdSignInFailed({ reason: "failed" });
      }

      return {
        // A refresh token states no end: it lasts until revoked, unused
        // six months, or seven days on a consent screen in Testing.
        expiresAt: Option.none(),
        platformUserId: subject.value,
        scopes,
        token: Redacted.make(answer.refresh_token),
      };
    }),
    // Read only: nothing is ever made, found, run or paused at Google.
    create: readOnly,
    find: () => Effect.succeed(absentLookUp),
    isRunning: () => Effect.succeed<LookUp<boolean>>({ _tag: "unknown" }),
    maySpend: () => false,
    network: "google",
    setRunning: readOnly,
    snapshot,
  };
};
