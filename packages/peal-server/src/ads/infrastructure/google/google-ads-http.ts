import { Duration, Effect, Option, Schema } from "effect";
import type { Redacted } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

import { AdNetworkRefused } from "#ads/application/ad-network-refused.ts";
import type { NetworkRefusalKind } from "#ads/application/ad-network-refused.ts";
import type { ReadFailure } from "#ads/application/ports/ad-network.ts";
import type { NetworkObjectId } from "#ads/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import { publicHttpClientWith } from "#shared/infrastructure/platforms/public-http.ts";

/**
 * The Google Ads API version the adapter calls: v26, the latest since
 * 14 October 2026, which Google ends in November 2027 ("Deprecation and
 * sunset", read 2026-11-16). Nothing upgrades it by itself: before that
 * end, read the release notes, move this constant, and run the adapter's
 * tests and a read of a test account.
 */
export const googleAdsApiVersion = "v26";

/** The HTTP client the adapter sends through: the public one. */
export type GoogleAdsHttp = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

// A page of `googleAds:search` holds up to 10,000 rows ("Search &
// SearchStream"): a campaign with its budget writes about 600 bytes, more
// than the public client's usual bound allows, and a full page takes
// longer to come than a platform's usual answer.
const maxAnswerBytes = 16 * 1024 * 1024;

/** The public HTTP client, with room and time for a page of results. */
export const googleAdsHttpClient = publicHttpClientWith({
  maxResponseBytes: maxAnswerBytes,
  timeout: "60 seconds",
});

/** Where Google's sign-in, its token endpoint and the Ads API are. */
export interface GoogleAdsEndpoints {
  /** The Google Ads API's origin. */
  readonly api: URL;
  /** The consent page the browser is sent to. */
  readonly authorization: URL;
  /** Where codes are exchanged and refresh tokens traded. */
  readonly token: URL;
}

// "Using OAuth 2.0 for Web Server Applications" and "Call structure"
// (read 2026-11-16).
export const googleAdsEndpoints: GoogleAdsEndpoints = {
  api: new URL("https://googleads.googleapis.com"),
  authorization: new URL("https://accounts.google.com/o/oauth2/v2/auth"),
  token: new URL("https://oauth2.googleapis.com/token"),
};

// A Status in `error`, as the REST interface writes a refusal, with its
// GoogleAdsFailure in `details` ("Understand API errors", read
// 2026-11-16). Each GoogleAdsError's `errorCode` has one key, its kind
// (`authorizationError`), whose value names the error. Messages are never
// read: they may quote the query.
const GoogleAdsErrorSchema = Schema.Struct({
  details: Schema.optionalKey(
    Schema.Struct({
      quotaErrorDetails: Schema.optionalKey(
        Schema.Struct({ retryDelay: Schema.optionalKey(Schema.String) })
      ),
    })
  ),
  errorCode: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

const RefusalSchema = Schema.Struct({
  error: Schema.Struct({
    details: Schema.optionalKey(
      Schema.Array(
        Schema.Struct({
          errors: Schema.optionalKey(Schema.Array(GoogleAdsErrorSchema)),
        })
      )
    ),
  }),
});

const decodeRefusal = Schema.decodeUnknownOption(RefusalSchema);

// A protobuf Duration in JSON: seconds with an `s`, maybe with a fraction
// ("JSON Mapping" of the protocol buffers guide).
const durationPattern = /^(?<seconds>\d{1,9})(?:\.\d{1,9})?s$/u;

const delayOf = (written: string | undefined) =>
  Option.fromNullishOr(durationPattern.exec(written ?? "")?.groups).pipe(
    Option.map((groups) => Duration.seconds(Number(groups["seconds"]))),
    Option.filter((delay) => !Duration.isZero(delay))
  );

/**
 * The day's operations spent (`RESOURCE_EXHAUSTED`): the allowance comes
 * back over a sliding day ("API limits and quotas"), so the account waits
 * this long, the longest the sync ever puts one off.
 */
export const dailyQuotaWait = Duration.hours(6);

// What the first error names, sorted for the code that acts on it.
const kindOf = (key: string, value: string): NetworkRefusalKind => {
  if (key !== "authorizationError") {
    return "other";
  }

  if (value === "CUSTOMER_NOT_ENABLED") {
    return "accountUnusable";
  }

  return value === "USER_PERMISSION_DENIED" ||
    value === "TWO_STEP_VERIFICATION_NOT_ENROLLED"
    ? "permission"
    : "other";
};

/**
 * What a Google Ads API answer that is not a success means: kept as
 * `google.<kind>.<VALUE>` of its first error, never with Google's message.
 * A body that cannot be read is judged by its status alone.
 */
export const refusalOf = Effect.fn("GoogleAds.refusalOf")(function* refusalOf(
  response: HttpClientResponse.HttpClientResponse
) {
  const body = yield* response.json.pipe(
    Effect.map(decodeRefusal),
    Effect.orElseSucceed(() => Option.none<typeof RefusalSchema.Type>())
  );

  const first = body.pipe(
    Option.flatMapNullishOr(
      ({ error }) => error.details?.flatMap(({ errors }) => errors ?? [])[0]
    )
  );

  const named = first.pipe(
    Option.flatMapNullishOr(({ errorCode }) =>
      errorCode === undefined ? undefined : Object.entries(errorCode)[0]
    )
  );

  const { status } = response;

  if (Option.isNone(named)) {
    if (status === 401) {
      return new TokenRejected();
    }

    if (status === 429) {
      return new RateLimited({});
    }

    return status >= 500
      ? new PlatformUnavailable()
      : new AdNetworkRefused({ code: `http${status}`, kind: "other" });
  }

  const [key, value] = named.value;
  const code = `google.${key}.${value}`;

  if (key === "authenticationError" || status === 401) {
    return new TokenRejected();
  }

  if (key === "quotaError" && value === "RESOURCE_EXHAUSTED") {
    return new RateLimited({ code, retryAfter: dailyQuotaWait });
  }

  if (key === "quotaError" || status === 429) {
    return new RateLimited(
      Option.match(
        delayOf(
          Option.getOrUndefined(first)?.details?.quotaErrorDetails?.retryDelay
        ),
        {
          onNone: () => ({ code }),
          onSome: (retryAfter) => ({ code, retryAfter }),
        }
      )
    );
  }

  if (status >= 500) {
    return new PlatformUnavailable();
  }

  if (value === "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION") {
    // The operator's project has the Test access level only: Google reads
    // test accounts for it, and no other until it is given Explorer.
    yield* Effect.logError(
      "Google Ads refused a read: the Cloud project of GOOGLE_ADS_CLIENT_ID reads test accounts only; apply for Explorer access"
    );
  }

  return new AdNetworkRefused({ code, kind: kindOf(key, value) });
});

const isSuccess = (response: HttpClientResponse.HttpClientResponse) =>
  response.status >= 200 && response.status < 300;

/**
 * A request to Google: a transport failure, a host the outbound guard
 * refused or an answer that does not decode is Google unavailable; any
 * other answer that is not a success is its refusal.
 */
export const read = <A, I>(
  http: GoogleAdsHttp,
  request: HttpClientRequest.HttpClientRequest,
  schema: Schema.Codec<A, I>
): Effect.Effect<A, ReadFailure> =>
  http.execute(request).pipe(
    Effect.catch(() => Effect.fail(new PlatformUnavailable())),
    Effect.flatMap((response): Effect.Effect<A, ReadFailure> =>
      isSuccess(response)
        ? HttpClientResponse.schemaBodyJson(schema)(response).pipe(
            Effect.mapError(() => new PlatformUnavailable())
          )
        : refusalOf(response).pipe(
            Effect.flatMap((refusal) => Effect.fail(refusal))
          )
    )
  );

/**
 * A request to the Google Ads API with an access token, and the manager
 * account it goes through when it reads a client account ("Call
 * structure": `login-customer-id`, digits without hyphens). No
 * `developer-token`: Google retired them on 9 September 2026, and access
 * levels belong to the Cloud project of the OAuth client ("Access levels").
 */
export const withAccess = (
  request: HttpClientRequest.HttpClientRequest,
  accessToken: Redacted.Redacted,
  through: Option.Option<NetworkObjectId>
) =>
  request.pipe(
    HttpClientRequest.bearerToken(accessToken),
    Option.match(through, {
      onNone: () => (same: HttpClientRequest.HttpClientRequest) => same,
      onSome: (manager) => (same: HttpClientRequest.HttpClientRequest) =>
        HttpClientRequest.setHeader(same, "login-customer-id", manager),
    })
  );
