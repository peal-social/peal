import { Effect, Layer, Option } from "effect";
import { SecureRandom } from "effect/crypto";
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";
import type { HttpApi, HttpApiGroup } from "effect/http-api";
import { Api, apiVersionHeader } from "peal-contract";
import { isRefusedPath } from "peal-contract/path-spelling";

import {
  countSentVersion,
  countsVersion,
  versionHeaders,
} from "#app/api-versions.ts";
import { bodyLimitFor, declaredPastLimit } from "#app/body-limits.ts";
import { deprecatedRoutes, deprecationOf } from "#app/deprecations.ts";
import {
  enveloped,
  isEnveloped,
  requestIssuesOf,
} from "#app/error-envelope.ts";
import { refusedPathError } from "#app/path-spelling.ts";
import {
  mapFailureResponse,
  requestIdAttribute,
  requestIdHeader,
  requestIdOf,
} from "#app/request-identity.ts";
import { AnswerHeaders } from "#shared/api/answer-headers.ts";
import { RequestId } from "#shared/api/request-id.ts";

const pathOf = (url: string) => url.split(/[?#]/u, 1)[0] ?? url;

/**
 * What every answer of the server has, whatever answers it (the API,
 * Better Auth, the MCP endpoint, a route that does not exist, a bug):
 *
 * - a request id, in `X-Request-Id`: the caller's own when it is well
 *   formed, so a client that numbers its calls finds them here, a UUIDv7
 *   otherwise. It is on every log line written while the request runs and
 *   on its span, and handlers read it as `RequestId`.
 * - the headers its handler and middlewares left for it (`AnswerHeaders`):
 *   a challenge, the limits that apply.
 * - the version of the API the server speaks, in `Peal-Version`
 *   (`#app/api-versions.ts`). A request of the API is counted under the
 *   version its client sent, and answered alike whatever it sent.
 * - on a deprecated endpoint of `api`, the headers that say so
 *   (`#app/deprecations.ts`).
 * - for an error of the API, the envelope (`#app/error-envelope.ts`):
 *   `code`, `message` and `requestId` beside the error's own fields.
 *
 * A path written to read differently to the proxy in front and to the
 * router (`isRefusedPath`, `peal-contract/path-spelling`) is refused with
 * 400 before any route runs, Better Auth's and the MCP endpoint's included.
 *
 * Every body is held to its route's limit (`bodyLimitFor`): one declared
 * larger is refused with 413 before any route runs, and one read past it
 * fails its read (`MaxBodySize`), which answers 413 too.
 *
 * A failure of the server's own keeps its cause, so it is logged, counted
 * and traced as one; a refusal of the caller is answered as a response
 * (`mapFailureResponse`), so it counts with the status the caller gets.
 */
export const apiAnswers = <
  Id extends string,
  Groups extends HttpApiGroup.Constraint,
>(
  api: HttpApi.HttpApi<Id, Groups>
) =>
  HttpRouter.middleware(
    Effect.gen(function* answers() {
      const random = yield* SecureRandom.SecureRandom;
      const deprecations = deprecatedRoutes(api);

      return (httpEffect) =>
        Effect.gen(function* answered() {
          const request = yield* HttpServerRequest.HttpServerRequest;

          const id = yield* requestIdOf(request.headers[requestIdHeader]).pipe(
            Option.match({
              onNone: () => random.uuidV7().pipe(Effect.orDie),
              onSome: Effect.succeed,
            })
          );

          // What handlers and middlewares leave for the answer, error or not,
          // and what it carries unless it has its own.
          const left = new Map<string, string>();
          const fallbacks = new Map<string, string>();

          const path = pathOf(request.url);

          const named = (response: HttpServerResponse.HttpServerResponse) =>
            HttpServerResponse.setHeaders(response, {
              ...Object.fromEntries(
                [...fallbacks].filter(
                  ([name]) => response.headers[name] === undefined
                )
              ),
              ...versionHeaders,
              ...deprecationOf(deprecations, request.method, path),
              ...Object.fromEntries(left),
              [requestIdHeader]: id,
            });

          const toldAs = isEnveloped(path)
            ? enveloped
            : () => (response: HttpServerResponse.HttpServerResponse) =>
                response;

          yield* Effect.annotateCurrentSpan(requestIdAttribute, id);

          if (isEnveloped(path) && countsVersion(path)) {
            yield* countSentVersion(request.headers[apiVersionHeader]);
          }

          if (isRefusedPath(request.url)) {
            return named(
              enveloped(
                id,
                Option.none()
              )(
                HttpServerResponse.jsonUnsafe(refusedPathError, { status: 400 })
              )
            );
          }

          const bodyLimit = bodyLimitFor(request.url);

          // Better Auth reads the web request itself, past MaxBodySize: a
          // body declared too large is refused here, for every route (one
          // with no length, Better Auth's routes read first: boundedBody).
          if (declaredPastLimit(request.headers["content-length"], bodyLimit)) {
            return named(
              toldAs(
                id,
                Option.none()
              )(HttpServerResponse.empty({ status: 413 }))
            );
          }

          return yield* httpEffect.pipe(
            // The routes that read less set their own, which comes first.
            Effect.provideService(HttpIncomingMessage.MaxBodySize, bodyLimit),
            Effect.provideService(RequestId, id),
            Effect.provideService(
              AnswerHeaders,
              AnswerHeaders.of({
                set: (name, value) =>
                  Effect.sync(() => {
                    left.set(name, value);
                  }),
                setUnlessAnswered: (name, value) =>
                  Effect.sync(() => {
                    fallbacks.set(name, value);
                  }),
              })
            ),
            Effect.map((response) =>
              named(toldAs(id, Option.none())(response))
            ),
            Effect.catchCause((cause) =>
              mapFailureResponse((response) =>
                named(toldAs(id, requestIssuesOf(cause))(response))
              )(cause)
            ),
            Effect.annotateLogs(requestIdAttribute, id)
          );
        });
    }),
    { global: true }
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto));

/** What every answer of Peal's server has: `apiAnswers`, for its API. */
export const ApiAnswersLive = apiAnswers(Api);
