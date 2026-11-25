import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

// What the MCP endpoint answers when it refuses a request before any tool
// runs. Every refusal is a JSON-RPC error with no request to answer
// (`id: null`), beside the HTTP status the specification fixes, as
// `mcpAuthentication` answers: -32000 is the implementation-defined code
// it uses. The endpoint never answers in the HTTP API's error envelope.

const refusalBody = (message: string) => ({
  error: { code: -32_000, message },
  id: null,
  jsonrpc: "2.0",
});

/** A refusal of the endpoint's own, with its status and message. */
export const jsonRpcRefusal = (status: number, message: string) =>
  HttpServerResponse.jsonUnsafe(refusalBody(message), { status });

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
 * them it is stays the opener's to know.
 */
const sessionNotFoundText =
  "No session of this credential has that Mcp-Session-Id: it ended, or it was never opened with this credential. Send initialize without the Mcp-Session-Id header to open a new one.";

/**
 * The words of the refusals effect/ai answers with a status alone, by
 * status (and method, for 400): what the request lacks, and what to send.
 */
const wordsFor = (status: number, method: string): Option.Option<string> => {
  switch (status) {
    case 400: {
      return Option.some(
        method === "DELETE"
          ? "DELETE ends a session: send the session's Mcp-Session-Id header with it."
          : "Send one JSON-RPC message per request: this endpoint takes no batches."
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
 */
const explained = (
  response: HttpServerResponse.HttpServerResponse,
  method: string
): HttpServerResponse.HttpServerResponse =>
  response.status < 400 || response.body._tag !== "Empty"
    ? response
    : Option.match(wordsFor(response.status, method), {
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

    return explained(yield* httpEffect, request.method);
  })
);
