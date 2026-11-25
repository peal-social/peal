import { Cause, Effect, Match, Option } from "effect";
import type { Schema } from "effect";
import type { HttpClientError } from "effect/http";

import { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import { unansweredAfterSending } from "#publishing/domain/removal-decision.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";

/** What can go wrong in an exchange with a platform, short of an answer. */
export type ExchangeError =
  | HttpClientError.HttpClientError
  | OutboundRequestRefused
  | Schema.SchemaError;

/**
 * The code of the `BadRequest` for a host the outbound guard refused for
 * good: it is not a public HTTPS server. Stored in the publication journal,
 * so never change it.
 */
export const hostNotAllowedCode = "hostNotAllowed";

// The outbound guard refused the host before anything was sent: for now if
// its name did not resolve, for good if it is not a public HTTPS server.
const refusedHost = (refused: OutboundRequestRefused) =>
  refused.reason === "lookupFailed"
    ? new PlatformUnavailable()
    : new BadRequest({ code: hostNotAllowedCode });

// Peal could not build the request: a bug, never the platform's doing.
const unbuildable = (error: HttpClientError.HttpClientError) =>
  Effect.die(error);

/**
 * A call that changes nothing anyone sees (an upload, a read) got no usable
 * answer: whatever it did does not matter, and it may be made again later.
 */
export const unanswered = (
  error: ExchangeError
): Effect.Effect<never, BadRequest | PlatformUnavailable> =>
  Match.valueTags(error, {
    HttpClientError: (failed) =>
      failed.reason._tag === "EncodeError" ||
      failed.reason._tag === "InvalidUrlError"
        ? unbuildable(failed)
        : Effect.fail(new PlatformUnavailable()),
    OutboundRequestRefused: (refused) => Effect.fail(refusedHost(refused)),
    SchemaError: () => Effect.fail(new PlatformUnavailable()),
  });

/**
 * A call that changes a live post got no usable answer, told by whether it
 * may have reached the platform: a request that timed out was sent, and
 * is `unansweredAfterSending`, which lets a repeat that finds the change
 * made count it (`editAfterRepeat`); any other transport error (a name
 * that did not resolve, a connection refused) may never have left, and is
 * a plain PlatformUnavailable.
 */
export const sentUnanswered = (
  error: ExchangeError
): Effect.Effect<never, BadRequest | PlatformUnavailable> =>
  error._tag === "HttpClientError" &&
  error.reason._tag === "TransportError" &&
  Cause.isTimeoutError(error.reason.cause)
    ? Effect.fail(new PlatformUnavailable({ code: unansweredAfterSending }))
    : unanswered(error);

/**
 * The call that makes a post live got no usable answer: the request may
 * have reached the platform, which may have made the post. Only a request
 * refused before it was sent is known not to.
 */
export const commitUnanswered = (
  error: ExchangeError
): Effect.Effect<never, BadRequest | OutcomeUnknown | PlatformUnavailable> =>
  Match.valueTags(error, {
    HttpClientError: (failed) => {
      const { reason } = failed;

      if (reason._tag === "EncodeError" || reason._tag === "InvalidUrlError") {
        return unbuildable(failed);
      }

      return Effect.fail(
        new OutcomeUnknown({
          reason:
            reason._tag === "TransportError"
              ? "noResponse"
              : "unreadableResponse",
        })
      );
    },
    OutboundRequestRefused: (refused) => Effect.fail(refusedHost(refused)),
    SchemaError: () =>
      Effect.fail(new OutcomeUnknown({ reason: "unreadableResponse" })),
  });

// A name such as `InvalidRequest` or `validation_failure`.
const identifier = /^[A-Za-z][\w.:-]{0,63}$/u;

/** A reason a platform gave, kept as a code if it is a plain identifier. */
export const codeOf = (reason: Option.Option<string>, fallback: string) =>
  reason.pipe(
    Option.filter((name) => identifier.test(name)),
    Option.getOrElse(() => fallback)
  );
