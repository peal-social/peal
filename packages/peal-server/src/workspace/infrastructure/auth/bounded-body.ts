import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";

// The headers a body read in full no longer has: it now has a length.
const framingHeaders: ReadonlySet<string> = new Set([
  "content-length",
  "transfer-encoding",
]);

/**
 * Holds a body Better Auth would read itself to the route's limit
 * (`HttpIncomingMessage.MaxBodySize`, which the server's answers provide):
 * Better Auth reads the web request, past Effect's reads, and the server
 * refuses only a declared length before any route runs. A body sent in
 * chunks, with no length, is read here under the limit (413 past it), and
 * the handler gets a request built from those bytes, the same bytes, so a
 * route that checks a signature over them (Stripe's events) checks what
 * was sent. A request with a declared length, or without a body, is left
 * as it came.
 */
export const boundedBody = <E, R>(
  handled: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>
) =>
  Effect.gen(function* bounded() {
    const request = yield* HttpServerRequest.HttpServerRequest;

    if (
      request.method === "GET" ||
      request.method === "HEAD" ||
      request.headers["content-length"] !== undefined
    ) {
      return yield* handled;
    }

    const web = yield* HttpServerRequest.toWeb(request);

    if (web.body === null) {
      return yield* handled;
    }

    const read = yield* request.arrayBuffer.pipe(Effect.result);

    if (read._tag === "Failure") {
      const { reason } = read.failure;

      return reason._tag === "RequestParseError" &&
        reason.reason === "BodyTooLarge"
        ? HttpServerResponse.empty({ status: 413 })
        : HttpServerResponse.empty({ status: 400 });
    }

    const headers = new Headers(
      [...web.headers].filter(([name]) => !framingHeaders.has(name))
    );

    const rebuilt = new Request(web.url, {
      body: read.success,
      headers,
      method: web.method,
      signal: web.signal,
    });

    return yield* handled.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(rebuilt)
      )
    );
  });
