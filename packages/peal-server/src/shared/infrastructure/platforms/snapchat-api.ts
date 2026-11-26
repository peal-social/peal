import { Effect, Option, Schema } from "effect";
import { HttpClientResponse } from "effect/http";

// Snap's Public Profile API (developers.snap.com, Marketing API, Public
// Profile API, read 2026-11-26), as the channels context signs in with it
// and publishing posts through it. Every answer of the Business API carries
// `request_id` and `request_status` (`SUCCESS`, `ERROR`, or `PARTIAL` on a
// list), and an error `error_code`, `debug_message` and `display_message`
// (Ads API, Errors). The two messages may quote what was sent, so they are
// never read; the pages do not say which HTTP status comes with `ERROR`, so
// an answer is a success only when its body says `SUCCESS`.

/** Where Snap's sign-in page, token endpoint and Business API are. */
export interface SnapchatHosts {
  /** https://accounts.snapchat.com: the sign-in page and the tokens. */
  readonly accounts: URL;
  /** https://businessapi.snapchat.com: the Public Profile API. */
  readonly api: URL;
}

export const snapchatHosts: SnapchatHosts = {
  accounts: new URL("https://accounts.snapchat.com"),
  api: new URL("https://businessapi.snapchat.com"),
};

/** The page the member signs in and agrees on, on `accounts`. */
export const snapchatAuthorizePath = "/login/oauth2/authorize";

/**
 * Where codes and refresh tokens are exchanged, on `accounts`. One sample of
 * Get Started names `/login/oauth2/token`; every other, and the
 * authentication page's reference, this one.
 */
export const snapchatTokenPath = "/login/oauth2/access_token";

/** The envelope every Business API answer shares, read for its status and code. */
export const SnapchatEnvelopeSchema = Schema.Struct({
  error_code: Schema.optionalKey(Schema.String),
  request_status: Schema.String,
});

export type SnapchatEnvelope = typeof SnapchatEnvelopeSchema.Type;

/** Whether an envelope says the request succeeded. */
export const succeeded = (envelope: SnapchatEnvelope): boolean =>
  envelope.request_status.toUpperCase() === "SUCCESS";

/**
 * The answer's envelope when its body is Snap's, none otherwise (an empty
 * body, a proxy's page, JSON of another shape).
 */
export const snapchatEnvelopeOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<SnapchatEnvelope>> =>
  HttpClientResponse.schemaBodyJson(SnapchatEnvelopeSchema)(response).pipe(
    Effect.map(Option.some),
    Effect.orElseSucceed(() => Option.none<SnapchatEnvelope>())
  );

// A code such as `AUTHORIZATION_PERMISSION_DENIED`, kept only when it is a
// plain identifier, as publishing keeps a platform's codes.
const identifier = /^[A-Za-z][\w.:-]{0,63}$/u;

/** An envelope's `error_code`, when it names one that is a plain identifier. */
export const plainErrorCodeOf = (
  envelope: SnapchatEnvelope
): Option.Option<string> =>
  Option.fromUndefinedOr(envelope.error_code).pipe(
    Option.filter((code) => identifier.test(code))
  );

/**
 * The answer's `error_code` when its body is Snap's envelope and names a
 * plain identifier.
 */
export const snapchatErrorCodeOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<string>> =>
  snapchatEnvelopeOf(response).pipe(
    Effect.map(Option.flatMap(plainErrorCodeOf))
  );

const profileIdPattern =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

/**
 * Whether a value is a Public Profile's id, a UUID in either case: it goes
 * into the path of every call, so nothing else is let through.
 */
export const isProfileId = (value: string): boolean =>
  profileIdPattern.test(value);
