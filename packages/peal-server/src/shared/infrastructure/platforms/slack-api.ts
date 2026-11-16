import { Duration, Effect, Option, Schema } from "effect";
import type { HttpClientResponse } from "effect/http";

// What the channels and publishing contexts share of Slack's Web API
// (docs.slack.dev, read 2026-11-16): where it is, how its answers look,
// and how a member's text is written so Slack takes it as text.
//
// Every method answers JSON with `ok`: `{ ok: true, … }`, or `{ ok: false,
// error }`, where `error` is one of the codes the method's page lists
// (`not_in_channel`, `invalid_auth`, `ratelimited`…). Peal decides on
// those codes and the status, never on any other words. A rate limit is a
// 429 with `Retry-After` in seconds ("Refer to the `Retry-After` header
// for when to retry the request").
//
// The bot's token goes in the `Authorization` header, never in an
// address; the upload address `files.getUploadURLExternal` answers is a
// ticket for one file. Both clients make no span (`untraced`,
// `./public-http.ts`), and every HTTP client error is typed where it
// happens.

/**
 * Where Slack is: its Web API and sign-in page on `https://slack.com`, and
 * the origin of the upload addresses it hands out, `https://files.slack.com`.
 * Tests point them at loopback fakes.
 */
export interface SlackHosts {
  readonly api: string;
  readonly uploads: string;
}

export const slackHosts: SlackHosts = {
  api: "https://slack.com",
  uploads: "https://files.slack.com",
};

/** The address of a Web API method. */
export const slackMethodUrl = (hosts: SlackHosts, method: string): URL =>
  new URL(`/api/${method}`, hosts.api);

// The codes Slack's methods answer for a token that no longer works:
// "Some aspect of authentication cannot be validated" (`invalid_auth`),
// "Authentication token is for a deleted user or workspace or the app has
// been removed" (`token_revoked`), "for a deleted user or workspace when
// using a `bot` token" (`account_inactive`), `token_expired`, and
// `not_authed` (none was sent).
const refusedTokenCodes: ReadonlySet<string> = new Set([
  "account_inactive",
  "invalid_auth",
  "not_authed",
  "token_expired",
  "token_revoked",
]);

/** Whether Slack's code says the token no longer works. */
export const isRefusedToken = (code: string): boolean =>
  refusedTokenCodes.has(code);

// "Rate limited; check the `Retry-After` header" (`ratelimited`), and
// "Application has posted too many messages" (`rate_limited`).
const rateLimitCodes: ReadonlySet<string> = new Set([
  "rate_limited",
  "ratelimited",
]);

/** Whether Slack's code is a rate limit. */
export const isRateLimit = (code: string): boolean => rateLimitCodes.has(code);

// "Likely transient server error; part of the operation may have
// succeeded" (`internal_error`), "catastrophic" (`fatal_error`), "The
// service is temporarily unavailable" (`service_unavailable`), "POST data
// was missing or truncated" (`request_timeout`).
const transientCodes: ReadonlySet<string> = new Set([
  "fatal_error",
  "internal_error",
  "request_timeout",
  "service_unavailable",
]);

/** Whether Slack's code is its own trouble, which says nothing of the call. */
export const isTransient = (code: string): boolean => transientCodes.has(code);

// A Slack error code: lowercase words joined by underscores.
const codePattern = /^[a-z][a-z0-9_]{0,63}$/u;

const OkSchema = Schema.Struct({ ok: Schema.Literal(true) });

const ErrorAnswerSchema = Schema.Struct({
  error: Schema.String,
  ok: Schema.Literal(false),
});

const isOk = Schema.is(OkSchema);

const isError = Schema.is(ErrorAnswerSchema);

/** What one call of the Web API came to. */
export type SlackAnswer =
  // `ok` true, the body as it came, to read with the method's schema.
  | { readonly _tag: "ok"; readonly body: unknown }
  // `ok` false, with one of Slack's codes.
  | { readonly _tag: "refused"; readonly code: string }
  // A 429, and the wait its `Retry-After` names.
  | {
      readonly _tag: "limited";
      readonly retryAfter: Option.Option<Duration.Duration>;
    }
  // Anything else: a 5xx, a body that is not Slack's, a code that is not
  // one. Whatever the call did is not known.
  | { readonly _tag: "unknown" };

const unknownAnswer: SlackAnswer = { _tag: "unknown" };

/** The wait a 429 names in `Retry-After`, in seconds. */
export const retryAfterOf = (
  response: HttpClientResponse.HttpClientResponse
): Option.Option<Duration.Duration> =>
  Option.fromUndefinedOr(response.headers["retry-after"]).pipe(
    Option.map(Number),
    Option.filter((seconds) => Number.isFinite(seconds) && seconds >= 0),
    Option.map((seconds) => Duration.seconds(seconds))
  );

/**
 * Reads a Web API answer once: Slack answers 200 whether it did the call
 * or refused it, and tells which by `ok`; a rate limit is a 429.
 */
export const slackAnswerOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<SlackAnswer> => {
  if (response.status === 429) {
    return Effect.succeed({
      _tag: "limited",
      retryAfter: retryAfterOf(response),
    });
  }

  if (response.status !== 200) {
    return Effect.succeed(unknownAnswer);
  }

  return response.json.pipe(
    Effect.map((body): SlackAnswer => {
      if (isOk(body)) {
        return { _tag: "ok", body };
      }

      if (isError(body) && codePattern.test(body.error)) {
        return isRateLimit(body.error)
          ? { _tag: "limited", retryAfter: Option.none() }
          : { _tag: "refused", code: body.error };
      }

      return unknownAnswer;
    }),
    Effect.orElseSucceed(() => unknownAnswer)
  );
};

/** The code Peal keeps for a refusal of Slack's: `slack:<code>`. */
export const slackCode = (code: string): string => `slack:${code}`;

/**
 * A member's text as Slack takes it: `&`, `<` and `>`, Slack's control
 * characters, "must be converted to HTML entities" (`&amp;`, `&lt;`,
 * `&gt;`), and nothing else, as "only the specific characters shown above
 * will be decoded for display in Slack" (docs.slack.dev/messaging/
 * formatting-message-text, read 2026-11-16). Slack reads `<…>` as its
 * markup otherwise, where `<!here>` and its kin notify a whole channel and
 * `<@U…>` a person: escaped, nothing a member types mentions anyone.
 * Slack's formatting (`*bold*`, `_italic_`, `~strike~`, `` `code` ``)
 * stays, and links are linked by Slack.
 */
export const escapedForSlack = (text: string): string =>
  text.replaceAll(/[&<>]/gu, (character) => {
    if (character === "&") {
      return "&amp;";
    }

    return character === "<" ? "&lt;" : "&gt;";
  });
