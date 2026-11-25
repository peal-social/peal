import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

// What the MCP endpoint answers when it refuses a request before any tool
// runs. The refusals it answers itself (its middlewares, effect/ai's
// transport, and the server-wide body limit on its path) are JSON-RPC
// errors with no request to answer (`id: null`), beside the HTTP status the
// specification fixes: -32000 is the implementation-defined code. Two
// answers keep another shape: a refused path spelling (400, in the API's
// error envelope, which `apiAnswers` gives every path before any route
// runs) and a session ended while its request ran (effect/ai's own answer,
// after every middleware). The guide lists them.

/** Where the MCP endpoint answers, under PUBLIC_URL. */
export const mcpPath = "/api/mcp";

const refusalBody = (message: string) => ({
  error: { code: -32_000, message },
  id: null,
  jsonrpc: "2.0",
});

/** A refusal of the endpoint's own, with its status and message. */
export const jsonRpcRefusal = (status: number, message: string) =>
  HttpServerResponse.jsonUnsafe(refusalBody(message), { status });

/**
 * A body declared larger than the endpoint takes, refused before it is
 * read (`apiAnswers`), in the words `mcpAuthentication` uses for one read
 * past the limit.
 */
export const bodyTooLarge = () =>
  jsonRpcRefusal(
    413,
    "The request's body is larger than this endpoint takes, so nothing was done. Send less in one request."
  );

/**
 * Why a request with an `Origin` header is refused: no web page calls the
 * endpoint (the transport's security warning in each revision it serves:
 * an `Origin` that is present and invalid gets a 403).
 */
export const originRefusedText =
  "Requests with an Origin header are refused: this endpoint serves MCP clients, never web pages. Send the request from the client itself, without an Origin header.";

/**
 * What a session that is not the caller's is told, alike for one that
 * ended, one another credential opened and one that never was: which of
 * them it is stays the opener's to know. One text for the session guard's
 * 404 and effect/ai's, right for a sessionful client and for a client of
 * the stateless revision that sent the header anyway.
 */
const sessionNotFoundText =
  "No session of this credential has that Mcp-Session-Id: it ended, or it was never opened with this credential. Open a new one by sending initialize without the Mcp-Session-Id header, or, speaking the stateless revision 2026-07-28, send the request without the Mcp-Session-Id header.";

/**
 * The words of the refusals answered with a status alone, by status, and
 * for a DELETE's 400 by what it sent. effect/ai ends a session on a DELETE
 * that names it in `Mcp-Session-Id`, in the protocol version the session
 * speaks: without the header, or with an `MCP-Protocol-Version` it does not
 * take or the session did not negotiate, it answers 400 alone.
 */
const wordsFor = (
  status: number,
  request: HttpServerRequest.HttpServerRequest
): Option.Option<string> => {
  switch (status) {
    case 400: {
      if (request.method !== "DELETE") {
        return Option.some(
          "Send one JSON-RPC message per request: this endpoint takes no batches."
        );
      }

      return Option.some(
        request.headers["mcp-session-id"] === undefined
          ? "DELETE ends a session: send the session's Mcp-Session-Id header with it."
          : "The MCP-Protocol-Version header is not the protocol version this session speaks. Send the version the session negotiated with initialize, or leave the header out."
      );
    }

    case 403: {
      return Option.some(originRefusedText);
    }

    case 404: {
      return Option.some(sessionNotFoundText);
    }

    case 405: {
      return Option.some(
        "This endpoint takes POST for JSON-RPC messages, and DELETE to end a session."
      );
    }

    case 406: {
      return Option.some(
        "The Accept header must list both application/json and text/event-stream."
      );
    }

    case 415: {
      return Option.some(
        "Send each JSON-RPC message as JSON, with the Content-Type application/json."
      );
    }

    default: {
      return Option.none();
    }
  }
};

/**
 * A refusal without a body, given the words of its status; its headers
 * (`Allow` on a 405) are kept. Any other answer is left as it is.
 *
 * A status stands for one refusal because one component alone answers it
 * without a body today. An empty 403 is effect/ai's `Origin` check, which
 * `mcpRefusalAnswers` answers first anyway: `mcpAuthentication`'s 403s carry
 * their own words. An empty 404 is a session that is not the caller's (the
 * session guard) or that effect/ai does not hold: only the endpoint's own
 * routes pass here. When a middleware this wraps gains another empty 403
 * or 404, give that one a body of its own, or this tells it the wrong
 * words.
 */
const explained = (
  response: HttpServerResponse.HttpServerResponse,
  request: HttpServerRequest.HttpServerRequest
): HttpServerResponse.HttpServerResponse =>
  response.status < 400 || response.body._tag !== "Empty"
    ? response
    : Option.match(wordsFor(response.status, request), {
        onNone: () => response,
        onSome: (message) =>
          HttpServerResponse.jsonUnsafe(refusalBody(message), {
            headers: response.headers,
            status: response.status,
          }),
      });

/**
 * The endpoint's refusals, around every other middleware: a request with an
 * `Origin` header is refused before its credential is read (403, whatever
 * the credential, as effect/ai would refuse it after), and a refusal that
 * effect/ai or the session guard answers with a status alone is given the
 * words of its status.
 */
export const mcpRefusalAnswers = HttpRouter.middleware((httpEffect) =>
  Effect.gen(function* answered() {
    const request = yield* HttpServerRequest.HttpServerRequest;

    if (request.headers["origin"] !== undefined) {
      return jsonRpcRefusal(403, originRefusedText);
    }

    return explained(yield* httpEffect, request);
  })
);
