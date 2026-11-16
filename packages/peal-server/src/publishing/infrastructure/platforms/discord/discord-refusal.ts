import { DateTime, Effect, Option } from "effect";
import type { HttpClientResponse } from "effect/http";

import { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import { platformRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  discordCodeOf,
  discordCodes,
  discordRetryAfterOf,
  isWebhookGone,
} from "#shared/infrastructure/platforms/discord-api.ts";
import { retryAfterOf } from "#shared/infrastructure/platforms/retry-after.ts";

/** The code of a refusal Discord names by its number, never its words. */
export const discordCode = (code: number): string => `discord${String(code)}`;

/**
 * A refusal of a call to a webhook, read from its status and Discord's own
 * JSON code (the opcodes and status codes page), never its message:
 *
 * - 401, 403 or 404 with 10015 (unknown webhook) or 50027 (invalid token):
 *   the webhook was deleted, `TokenRejected`, and nothing renews it;
 * - 429: `RateLimited`, for as long as the answer says;
 * - 40005 (request too large) and 50045 (a file too large): `MediaRejected`;
 * - 220001 (a forum channel's post needs a thread name):
 *   `forumThreadNameRequired`; 220003 (a thread name on a channel that is
 *   no forum): `threadNameNotTaken`;
 * - any other 4xx with Discord's JSON: `BadRequest` with its code.
 *
 * What is left (a 5xx, a 4xx without Discord's JSON, which a server on the
 * way answered) is `unanswered`: the platform unavailable for a call that
 * changes nothing anyone sees, an unknown outcome for the one that posts.
 */
export const discordRefusal = <E>(
  response: HttpClientResponse.HttpClientResponse,
  unanswered: () => E
): Effect.Effect<never, E | PublishFailure | TokenRejected> =>
  Effect.gen(function* refusal() {
    const { status } = response;

    if (status === 429) {
      const now = yield* DateTime.now;

      const wait = Option.orElse(yield* discordRetryAfterOf(response), () =>
        retryAfterOf(response.headers, now)
      );

      return yield* Option.match(wait, {
        onNone: () => new RateLimited({}),
        onSome: (retryAfter) => new RateLimited({ retryAfter }),
      });
    }

    const code =
      status >= 400 && status < 500
        ? yield* discordCodeOf(response)
        : Option.none<number>();

    if (isWebhookGone(status, code)) {
      return yield* new TokenRejected();
    }

    if (Option.isNone(code)) {
      return yield* Effect.fail(unanswered());
    }

    switch (code.value) {
      case discordCodes.requestTooLarge:
      case discordCodes.fileTooLarge: {
        return yield* new MediaRejected({ code: "tooLarge" });
      }

      case discordCodes.forumNeedsThread: {
        return yield* new BadRequest({
          code: platformRefusalCodes.forumThreadNameRequired,
        });
      }

      case discordCodes.threadsOnlyInForums: {
        return yield* new BadRequest({
          code: platformRefusalCodes.threadNameNotTaken,
        });
      }

      default: {
        return yield* new BadRequest({ code: discordCode(code.value) });
      }
    }
  });

/** A call that changes nothing anyone sees, unanswered: try again later. */
export const unavailable = () => new PlatformUnavailable();

/** The call that posts, unanswered: the message may be there. */
export const unknownOutcome = () =>
  new OutcomeUnknown({ reason: "noResponse" });
