import { Layer } from "effect";
import { HttpMiddleware, UrlParams } from "effect/http";

// No server span for these: the HTTP tracer records `url.full`, the
// visitor's browser and address. A short link's redirect would keep what
// the privacy register says Peal never keeps (counted in
// `peal.shortlinks.redirects` instead); the weekly digest's unsubscribe
// link would keep its token, a capability that never expires.
const untracedPrefixes = [
  "/api/l/",
  "/api/notifications/weekly-digest/unsubscribe/",
];

/** Whether the HTTP tracer leaves the request at this address out. */
export const isUntraced = (url: string): boolean =>
  untracedPrefixes.some((prefix) => url.startsWith(prefix));

/** The tracer's exception for those paths, for the routes' layer. */
export const UntracedPathsLive = Layer.succeed(
  HttpMiddleware.TracerDisabledWhen
)((request) => isUntraced(request.url));

/**
 * The query parameters the HTTP tracer writes as `<redacted>` in
 * `url.full` and `url.query`, besides Effect's own (signed storage
 * addresses' signatures): a sign-in provider sends the browser back to
 * `/api/auth/callback/:id` with its authorization code and the sign-in's
 * state in the address, an OAuth client's authorization carries its own
 * state, and Meta's events' handshake the operator's verify token
 * (`/api/platform-events/meta/:app`).
 */
export const redactedQueryNames: readonly string[] = [
  "code",
  "state",
  "hub.verify_token",
];

/** Those names, beside Effect's, for the routes' layer. */
export const RedactedQueryLive = Layer.succeed(UrlParams.CurrentRedactedNames)([
  ...UrlParams.CurrentRedactedNames.defaultValue(),
  ...redactedQueryNames,
]);
