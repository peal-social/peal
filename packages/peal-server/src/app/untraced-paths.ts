import { Cause, Effect, Exit, Layer, Option } from "effect";
import {
  HttpMiddleware,
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  UrlParams,
} from "effect/http";

// The paths whose last segment is a capability: the weekly digest's
// unsubscribe link, which never expires, and the link of a password
// reset's email, which Better Auth checks before it sends the browser on.
const secretPathPrefixes = [
  "/api/notifications/weekly-digest/unsubscribe/",
  "/api/auth/reset-password/",
];

// No server span for these: the HTTP tracer records `url.full`, the
// visitor's browser and address. A short link's redirect would keep what
// the privacy register says Peal never keeps (counted in
// `peal.shortlinks.redirects` instead), and a picture's would record that
// someone opened an email; the others would keep their token.
const untracedPrefixes = [
  "/api/l/",
  "/api/email-assets/",
  ...secretPathPrefixes,
];

const pathOf = (url: string) => url.split(/[?#]/u, 1)[0] ?? url;

/** Whether the HTTP tracer leaves the request at this address out. */
export const isUntraced = (url: string): boolean =>
  untracedPrefixes.some((prefix) => url.startsWith(prefix));

/** The tracer's exception for those paths, for the routes' layer. */
export const UntracedPathsLive = Layer.succeed(
  HttpMiddleware.TracerDisabledWhen
)((request) => isUntraced(request.url));

/**
 * What the request log writes of a path whose last segment is a token
 * (`secretPathPrefixes`): the path with `<redacted>` in its place, none
 * for any other path, which is written as it is.
 */
export const loggedPathOf = (url: string): Option.Option<string> => {
  const path = pathOf(url);

  return Option.fromUndefinedOr(
    secretPathPrefixes.find((prefix) => path.startsWith(prefix))
  ).pipe(Option.map((prefix) => `${prefix}<redacted>`));
};

// The line Effect's request logger writes, for the status the caller got
// and, for a failure of the server's own, its cause.
const logAnswer = (
  method: string,
  url: string,
  exit: Exit.Exit<{ readonly status: number }, unknown>
) => {
  const [response, cause]: readonly [
    { readonly status: number },
    Option.Option<Cause.Cause<unknown>>,
  ] = Exit.isSuccess(exit)
    ? [exit.value, Option.none()]
    : HttpServerError.causeResponseStripped(exit.cause);

  const failure = cause.pipe(
    Option.filter((failed) => !Cause.hasInterruptsOnly(failed))
  );

  const line = Option.isSome(failure)
    ? Effect.log(failure.value)
    : Effect.log("Sent HTTP response");

  return line.pipe(
    Effect.annotateLogs({
      "http.method": method,
      "http.status": response.status,
      "http.url": url,
    })
  );
};

/**
 * Keeps a token in a request's path out of the request log: for the paths
 * of `secretPathPrefixes`, Effect's logger, which writes the path as it
 * came, is turned off, and the same line is written with the token
 * replaced (`loggedPathOf`). Its query, the logger never writes.
 */
export const SecretPathsLive = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* secretPaths() {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const logged = loggedPathOf(request.url);

      if (Option.isNone(logged)) {
        return yield* httpEffect;
      }

      return yield* HttpMiddleware.withLoggerDisabled(httpEffect).pipe(
        Effect.onExit((exit) => logAnswer(request.method, logged.value, exit))
      );
    }),
  { global: true }
);

/**
 * The query parameters the HTTP tracer writes as `<redacted>` in
 * `url.full` and `url.query`, besides Effect's own (signed storage
 * addresses' signatures): a sign-in provider sends the browser back to
 * `/api/auth/callback/:id` with its authorization code and the sign-in's
 * state in the address, an OAuth client's authorization carries its own
 * state, Meta's events' handshake the operator's verify token
 * (`/api/platform-events/meta/:app`), a token in any address, and the
 * code the person types to approve the command line's device sign-in
 * (`/api/auth/device?user_code=`), and a post's external id, the caller's
 * content (`GET /api/v1/posts?externalId=`).
 */
export const redactedQueryNames: readonly string[] = [
  "code",
  "externalId",
  "state",
  "hub.verify_token",
  "token",
  "user_code",
];

/** Those names, beside Effect's, for the routes' layer. */
export const RedactedQueryLive = Layer.succeed(UrlParams.CurrentRedactedNames)([
  ...UrlParams.CurrentRedactedNames.defaultValue(),
  ...redactedQueryNames,
]);
