import { DateTime, Duration, Effect, Metric, Option, Schema } from "effect";
import type { HttpClientResponse } from "effect/http";

import { graphUsageOf } from "./graph-usage.ts";
import { retryAfterOf } from "./retry-after.ts";

// The error bodies of Meta's APIs. The Graph API, for Facebook, Instagram
// and Threads calls, answers `{ error: { message, type, code,
// error_subcode, is_transient, fbtrace_id } }`; the Threads token endpoints
// answer `{ error_type, code, error_message }`. Messages are never kept:
// they may quote what was sent. The type (`OAuthException`…) and
// `fbtrace_id`, which Meta's support asks for, are logged and traced only
// when they read as a name and an id do.
const MetaNameSchema = Schema.String.check(Schema.isPattern(/^[\w.]{1,64}$/u));

const GraphErrorSchema = Schema.Struct({
  error: Schema.Struct({
    code: Schema.optionalKey(Schema.Number),
    error_subcode: Schema.optionalKey(Schema.Number),
    fbtrace_id: Schema.optionalKey(Schema.String),
    is_transient: Schema.optionalKey(Schema.Boolean),
    type: Schema.optionalKey(Schema.String),
  }),
});

const OAuthErrorSchema = Schema.Struct({
  code: Schema.optionalKey(Schema.Number),
  error_type: Schema.optionalKey(Schema.String),
});

const isMetaName = Schema.is(MetaNameSchema);

const nameOf = (value: string | undefined): Option.Option<string> =>
  value !== undefined && isMetaName(value) ? Option.some(value) : Option.none();

const decodeErrorBody = Schema.decodeUnknownOption(
  Schema.Union([GraphErrorSchema, OAuthErrorSchema])
);

type ErrorBody = typeof GraphErrorSchema.Type | typeof OAuthErrorSchema.Type;

/** What Meta's error said, as far as Peal reads it. */
interface GraphError {
  readonly code: Option.Option<number>;
  readonly subcode: Option.Option<number>;
  readonly trace: Option.Option<string>;
  readonly transient: boolean;
  readonly type: Option.Option<string>;
}

const noError: GraphError = {
  code: Option.none(),
  subcode: Option.none(),
  trace: Option.none(),
  transient: false,
  type: Option.none(),
};

const errorOf = (body: ErrorBody): GraphError =>
  "error" in body
    ? {
        code: Option.fromUndefinedOr(body.error.code),
        subcode: Option.fromUndefinedOr(body.error.error_subcode),
        trace: nameOf(body.error.fbtrace_id),
        transient: body.error.is_transient ?? false,
        type: nameOf(body.error.type),
      }
    : {
        ...noError,
        code: Option.fromUndefinedOr(body.code),
        type: nameOf(body.error_type),
      };

/**
 * What Meta said of a refusal, as span attributes and log annotations:
 * the status, the code and subcode, the type and the trace id, never the
 * message.
 */
const describedOf = (error: GraphError, status: number) => ({
  "meta.error.code": Option.getOrUndefined(error.code),
  "meta.error.subcode": Option.getOrUndefined(error.subcode),
  "meta.error.trace_id": Option.getOrUndefined(error.trace),
  "meta.error.type": Option.getOrUndefined(error.type),
  "meta.status": status,
});

/**
 * Why Meta refused a call, sorted for the code that acts on it:
 *
 * - `token`: the token is invalid, expired or revoked, lacks a permission
 *   (`permission`: code 10 or 200 to 299, where a new token helps only once
 *   the account grants it), or its user lost their role on the Page.
 * - `rateLimited`: a rate limit, or a temporary block; wait `retryAfter`
 *   when Meta said how long.
 * - `unavailable`: Meta failed or said to try again: the call did nothing.
 * - `duplicate`: the same post was just published (code 506).
 * - `refused`: Meta refused the request as sent, with `code` naming why
 *   (`graph<code>` or `graph<code>.<subcode>`, or `http<status>`).
 */
export type GraphRefusal =
  | {
      readonly _tag: "token";
      // Meta's code, as `refused` names it (`graph10`, `http403`).
      readonly code: string;
      readonly permission: boolean;
      // Meta named the refusal with a Graph error code; false for a bare
      // 401 or 403, which a proxy on the way may give as well.
      readonly coded: boolean;
    }
  | {
      readonly _tag: "rateLimited";
      readonly retryAfter: Option.Option<Duration.Duration>;
    }
  | { readonly _tag: "unavailable" }
  | { readonly _tag: "duplicate" }
  | { readonly _tag: "refused"; readonly code: string };

// From the Graph API's "Handling Errors" and "Rate Limiting" pages: 102 and
// 190 are sessions and tokens (subcodes 458 to 467 say why), 492 a user who
// lost their role on the Page, 10 and 200 to 299 a permission the token
// lacks.
const isPermissionCode = (code: number) =>
  code === 10 || (code >= 200 && code <= 299);

const isTokenCode = (code: number) =>
  code === 102 || code === 190 || code === 492 || isPermissionCode(code);

// 4 the app, 17 the user, 32 a Page with a user token, 613 a custom limit,
// 80001 to 80014 a Page, an Instagram account and other business objects;
// 368 a temporary block for policy reasons, which also passes.
const isRateLimitCode = (code: number) =>
  code === 4 ||
  code === 17 ||
  code === 32 ||
  code === 613 ||
  code === 368 ||
  (code >= 80_001 && code <= 80_014);

// Instagram's content publishing limit: code 9, subcode 2207042.
const publishingLimit = { code: 9, subcode: 2_207_042 } as const;

// 1 and 2 are Meta's own failures, "try again later".
const isServiceCode = (code: number) => code === 1 || code === 2;

const codeName = (error: GraphError, status: number): string =>
  Option.match(error.code, {
    onNone: () => `http${status}`,
    onSome: (code) =>
      Option.match(error.subcode, {
        onNone: () => `graph${code}`,
        onSome: (subcode) => `graph${code}.${subcode}`,
      }),
  });

// A refused token marks the channel to reconnect once renewing it fails:
// what Meta said is logged, so the reason is known without its message.
const tokenRefusedLog = (described: ReturnType<typeof describedOf>) =>
  Effect.logWarning("Meta refused a token").pipe(
    Effect.annotateLogs(
      Object.fromEntries(
        Object.entries(described).filter(([, value]) => value !== undefined)
      )
    )
  );

// What the refusal is, from what Meta said of it (see `graphRefusalOf`).
const classified = Effect.fnUntraced(function* classified(
  response: HttpClientResponse.HttpClientResponse,
  error: GraphError,
  described: ReturnType<typeof describedOf>
) {
  const { status } = response;
  const now = yield* DateTime.now;

  const retryAfter = graphUsageOf(response.headers).pipe(
    Option.flatMap(({ regainAccessIn }) => regainAccessIn),
    Option.orElse(() => retryAfterOf(response.headers, now)),
    Option.filter((wait) => !Duration.isZero(wait))
  );

  const rateLimited: GraphRefusal = { _tag: "rateLimited", retryAfter };

  if (Option.isSome(error.code)) {
    const code = error.code.value;

    if (isTokenCode(code)) {
      yield* tokenRefusedLog(described);

      return {
        _tag: "token",
        code: codeName(error, status),
        coded: true,
        permission: isPermissionCode(code),
      } satisfies GraphRefusal;
    }

    if (
      isRateLimitCode(code) ||
      (code === publishingLimit.code &&
        Option.contains(error.subcode, publishingLimit.subcode))
    ) {
      return rateLimited;
    }

    if (isServiceCode(code) || error.transient) {
      return { _tag: "unavailable" } satisfies GraphRefusal;
    }

    if (code === 506) {
      return { _tag: "duplicate" } satisfies GraphRefusal;
    }
  }

  if (status === 429) {
    return rateLimited;
  }

  if (status >= 500 || error.transient) {
    return { _tag: "unavailable" } satisfies GraphRefusal;
  }

  if (Option.isNone(error.code) && (status === 401 || status === 403)) {
    yield* tokenRefusedLog(described);

    return {
      _tag: "token",
      code: codeName(error, status),
      coded: false,
      permission: false,
    } satisfies GraphRefusal;
  }

  const refusal: GraphRefusal = {
    _tag: "refused",
    code: codeName(error, status),
  };

  return refusal;
});

/**
 * Every call Meta refused, by API (`facebook`, `instagram`, `threads`),
 * kind (`token`, `permission`, `rateLimited`, `unavailable`, `duplicate`,
 * `refused`) and Meta's code (`graph10`, `http403`): Meta's codes are a
 * short list, never an account's or a post's. `permission` is a permission
 * the app lacks or the account did not grant, which no new token gives:
 * `peal-meta-permission-refused` watches it.
 */
export const metaRefusals = Metric.counter("peal.meta.refusals", {
  description: "Calls Meta refused, by API, kind and Meta's code",
  incremental: true,
});

// Which of Meta's APIs answered, from its host.
const apiOf = (response: HttpClientResponse.HttpClientResponse) => {
  const host = new URL(response.request.url).hostname;

  if (host.includes("threads")) {
    return "threads";
  }

  return host.includes("instagram") ? "instagram" : "facebook";
};

const kindOf = (refusal: GraphRefusal) =>
  refusal._tag === "token" && refusal.permission ? "permission" : refusal._tag;

/**
 * What a Meta answer that is not a success means, from its status, its
 * error body and its usage headers. A body that cannot be read is judged by
 * the status alone. What Meta said goes on the span, and the refusal is
 * counted in `peal.meta.refusals`.
 */
export const graphRefusalOf = Effect.fn("MetaGraph.refusalOf")(
  function* graphRefusalOf(response: HttpClientResponse.HttpClientResponse) {
    const error = yield* response.json.pipe(
      Effect.map((body) =>
        decodeErrorBody(body).pipe(
          Option.map(errorOf),
          Option.getOrElse(() => noError)
        )
      ),
      Effect.orElseSucceed(() => noError)
    );

    const described = describedOf(error, response.status);

    yield* Effect.forEach(
      Object.entries(described),
      ([key, value]) =>
        value === undefined
          ? Effect.void
          : Effect.annotateCurrentSpan(key, value),
      { discard: true }
    );

    const refusal = yield* classified(response, error, described);

    yield* Metric.update(
      Metric.withAttributes(metaRefusals, {
        api: apiOf(response),
        code: codeName(error, response.status),
        kind: kindOf(refusal),
      }),
      1
    );

    return refusal;
  }
);
