import { Cause, Effect, Option } from "effect";
import { HttpServerError } from "effect/http";
import type { HttpServerResponse } from "effect/http";

/** The header that carries a request's id, in the request and the answer. */
export const requestIdHeader = "x-request-id";

/** The name of a request's id in log lines and on its span. */
export const requestIdAttribute = "peal.request_id";

// What a caller may send as an id: 8 to 128 letters, digits, dots, colons,
// underscores and hyphens, so it goes into a log line or a header as it is.
const wellFormed = /^[\w.:-]{8,128}$/u;

/**
 * Answers a failure with the response it would get anyway, changed by
 * `change`. A refusal of the caller (a status under 500: a request the API
 * could not decode, a body too large) is answered as a response, its cause
 * left: the server answered it as it should. A failure of the server's own
 * (5xx) or an interruption keeps the rest of its cause, so it is logged,
 * counted and traced as a failure.
 *
 * Effect's handler sends a response a failure carries, then fails on with
 * the cause less that response, so the middlewares outside it (the request
 * counter, the access log, the request's span) would read a 500 for a
 * refusal it answered with a 400.
 */
export const mapFailureResponse =
  (
    change: (
      response: HttpServerResponse.HttpServerResponse
    ) => HttpServerResponse.HttpServerResponse
  ) =>
  <E>(cause: Cause.Cause<E>) =>
    HttpServerError.causeResponse(cause).pipe(
      Effect.flatMap(([response, rest]) => {
        const changed = change(response);

        return changed.status < 500 && !Cause.hasInterrupts(cause)
          ? Effect.succeed(changed)
          : Effect.failCause(
              Cause.fromReasons([
                ...rest.reasons.filter(
                  (reason) =>
                    !(reason._tag === "Die" && reason.defect === response)
                ),
                Cause.makeDieReason(changed),
              ])
            );
      })
    );

/** The id a caller sent, when it is well formed. */
export const requestIdOf = (sent: string | undefined): Option.Option<string> =>
  sent !== undefined && wellFormed.test(sent)
    ? Option.some(sent)
    : Option.none();
