import { Effect, Option } from "effect";
import type { HttpClientResponse } from "effect/http";

import { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import { platformRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import { telegramErrorOf } from "#shared/infrastructure/platforms/telegram-api.ts";

/** The code of a refusal Telegram names by its number, never its words. */
export const telegramCode = (code: number): string => `telegram${String(code)}`;

/**
 * A refusal of a Bot API call, read from Telegram's own JSON (`ok: false`,
 * `error_code`, `parameters`), never its description, which the page does
 * not document:
 *
 * - 401 (the token was revoked) and 403 (the bot was removed from the
 *   chat, or may not post there): `TokenRejected`, and nothing renews it;
 * - 429: `RateLimited`, for `parameters.retry_after`;
 * - 400 with `parameters.migrate_to_chat_id`: the group became a
 *   supergroup with a new id, `chatMigrated`;
 * - 413: `MediaRejected`;
 * - any other 4xx: `BadRequest` with its code (`telegram400`: no 400 can
 *   be told from another without its words).
 *
 * What is left (a 5xx, an answer that is not Telegram's) is `unanswered`:
 * the platform unavailable for a call that changes nothing anyone sees, an
 * unknown outcome for the one that sends.
 */
export const telegramRefusal = <E>(
  response: HttpClientResponse.HttpClientResponse,
  unanswered: () => E
): Effect.Effect<never, E | PublishFailure | TokenRejected> =>
  Effect.gen(function* refusal() {
    const found = yield* telegramErrorOf(response);

    if (Option.isNone(found) || found.value.code >= 500) {
      return yield* Effect.fail(unanswered());
    }

    const { code, migratedTo, retryAfter } = found.value;

    if (code === 401 || code === 403) {
      return yield* new TokenRejected();
    }

    if (code === 429) {
      return yield* Option.match(retryAfter, {
        onNone: () => new RateLimited({}),
        onSome: (wait) => new RateLimited({ retryAfter: wait }),
      });
    }

    if (code === 413) {
      return yield* new MediaRejected({ code: "tooLarge" });
    }

    return yield* new BadRequest({
      code: Option.isSome(migratedTo)
        ? platformRefusalCodes.chatMigrated
        : telegramCode(code),
    });
  });

/** A call that changes nothing anyone sees, unanswered: try again later. */
export const unavailable = () => new PlatformUnavailable();

/** The call that sends, unanswered: the message may be there. */
export const unknownOutcome = () =>
  new OutcomeUnknown({ reason: "noResponse" });
