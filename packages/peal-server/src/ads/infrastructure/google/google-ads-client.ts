import { Duration, Effect, Option, Redacted, Result, Schema } from "effect";
import { Base64Url } from "effect/encoding";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import { AdNetworkRefused } from "#ads/application/ad-network-refused.ts";
import { AdSignInFailed } from "#ads/application/ad-sign-in-failed.ts";
import type {
  AdNetworkClient,
  LookUp,
  ReadFailure,
  SnapshotRequest,
} from "#ads/application/ports/ad-network.ts";
import type { AdAccountFacts } from "#ads/domain/ad-account-facts.ts";
import type { NetworkObjectId } from "#ads/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import { addDays } from "#shared/domain/wall-clock.ts";
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
  dayOf,
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
// Ordered by level, so the manager's own row comes first, and read to its
// last page: a limit would apply before sub-managers are left out.
const clientsQuery =
  "SELECT customer_client.client_customer, customer_client.level, customer_client.manager, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.id, customer_client.status, customer_client.test_account FROM customer_client WHERE customer_client.status = 'ENABLED' ORDER BY customer_client.level";

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
  `SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '${dayText(since)}' AND '${dayText(until)}' ORDER BY segments.date`;

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
  /** Whether it stopped at the bound of pages, with more to read. */
  readonly cut: boolean;
  readonly halted: Option.Option<Duration.Duration>;
  readonly rows: readonly A[];
}

/**
 * How long an account waits when a read was cut at the bound of pages: it
 * is not marked read, and the next run reads it again.
 */
const cutWait = Duration.hours(1);

// A search of days cut at the bound goes on from the last day it reached,
// this many times in one read at most.
const maxDayContinuations = 5;

const absentLookUp: LookUp<never> = { _tag: "unknown" };

/** The days a read took, and, when it was cut, which it read whole. */
interface DaysRead extends Searched<typeof DayRowSchema.Type> {
  readonly wholeThrough: Option.Option<LocalDate>;
}

// The days read whole: all those asked, when the search ended; up to the
// last whole day, when it was cut; none when Google asked to wait.
const coverOf = (
  days: Searched<typeof DayRowSchema.Type> & {
    readonly wholeThrough?: Option.Option<LocalDate>;
  },
  request: SnapshotRequest
) => {
  if (days.complete) {
    return Option.some({ from: request.since, to: request.until });
  }

  return (days.cut ? (days.wholeThrough ?? Option.none()) : Option.none()).pipe(
    Option.filter((to) => dayText(to) >= dayText(request.since)),
    Option.map((to) => ({ from: request.since, to }))
  );
};

// What the token endpoint's refusal means: Peal's client, which only
// the operator can fix; `invalid_grant`, the refresh token or the code
// (revoked, unused six months, past the seven days of a consent screen in
// Testing, or past the hundred a Google account may hold), which only a
// new sign-in replaces; anything else, Google unavailable.
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

        // Only `invalid_grant` names the grant itself; any other refusal
        // (a malformed request, a scope, a policy, a proxy's page) is no
        // reason to ask the person to sign in again.
        if (code === "invalid_grant") {
          return Effect.fail(new TokenRejected());
        }

        return Effect.logWarning(
          "Google's token endpoint refused a request"
        ).pipe(
          Effect.annotateLogs({
            code: code === "" ? `http${response.status}` : code,
          }),
          Effect.andThen(Effect.fail(new PlatformUnavailable()))
        );
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
        cut: false,
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
            cut: false,
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

    const all: Searched<A> = {
      complete,
      cut: !complete,
      halted: Option.none(),
      rows,
    };

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

        const { complete, rows } = listing.value;
        const self = rows.find((row) => levelOf(row) === 0);

        if (!complete) {
          yield* Effect.logWarning(
            "A Google Ads manager's clients were not read whole: those past the bound are left out"
          ).pipe(Effect.annotateLogs({ read: rows.length }));
        }

        if (self === undefined) {
          yield* Effect.logWarning(
            "A Google Ads account answered no row of its own: it is left out"
          );
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

  /**
   * The days asked, ordered by date. A search cut at the bound of pages
   * may hold its last day in part: the next search starts again from that
   * day, a few times at most. What stays cut says which days were read
   * whole (`wholeThrough`), and nothing else is taken for whole.
   */
  const readDays = Effect.fn("GoogleAds.readDays")(function* readDays(
    access: Redacted.Redacted,
    request: SnapshotRequest
  ) {
    const rows: (typeof DayRowSchema.Type)[] = [];
    let from = request.since;
    let wholeThrough = Option.none<LocalDate>();

    for (let search = 0; search <= maxDayContinuations; search += 1) {
      const part = yield* unlessLimited(
        searched(
          access,
          request.externalId,
          request.reachedThrough,
          daysQuery(from, request.until),
          DayRowSchema
        )
      );

      rows.push(...part.rows);

      if (!part.cut) {
        const ended: DaysRead = { ...part, rows, wholeThrough };

        return ended;
      }

      const last = part.rows
        .flatMap((row) => Option.toArray(dayOf(row.segments.date)))
        .map(dayText)
        .toSorted()
        .at(-1);

      // One day alone fills every page: nothing more can be read whole.
      if (last === undefined || last === dayText(from)) {
        break;
      }

      from = Option.getOrThrow(dayOf(last));
      wholeThrough = Option.some(addDays(from, -1));
    }

    const cut: DaysRead = {
      complete: false,
      cut: true,
      halted: Option.none(),
      rows,
      wholeThrough,
    };

    return cut;
  });

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
        ? { complete: false, cut: false, halted: Option.none(), rows: [] }
        : yield* readDays(access, request);

      if (campaigns.cut || days.cut) {
        yield* Effect.logWarning(
          "A Google Ads account took more pages than a read takes: it is read again later, and not marked read"
        ).pipe(
          Effect.annotateLogs({
            campaigns: campaigns.cut,
            days: days.cut,
            rows: campaigns.rows.length + days.rows.length,
          })
        );
      }

      const kept = days.rows.flatMap((row) =>
        Option.toArray(campaignDayOf(row))
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
        campaignDaysCover: coverOf(days, request),
        campaigns: campaigns.rows.flatMap((row) =>
          Option.toArray(campaignOf(row, currency, timeZone))
        ),
        complete: campaigns.complete,
        facts: Option.some(facts),
        haltedFor: Option.orElse(campaigns.halted, () => days.halted).pipe(
          Option.orElse(() =>
            campaigns.cut || days.cut ? Option.some(cutWait) : Option.none()
          )
        ),
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
