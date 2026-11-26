import { DateTime, Effect, Option } from "effect";
import type { HttpClientResponse } from "effect/http";

import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import { retryAfterOf } from "#shared/infrastructure/platforms/retry-after.ts";
import {
  plainErrorCodeOf,
  snapchatEnvelopeOf,
} from "#shared/infrastructure/platforms/snapchat-api.ts";

export type SnapchatRefusal = PublishFailure | TokenRejected;

/**
 * Which call Snap refused: making the media object (`createMedia`), sending
 * a part of it or finalizing it (`upload`), or posting the Spotlight.
 */
export type SnapchatCall = "createMedia" | "spotlight" | "upload";

// How Snap refuses a token. Its authentication page documents a 401 with
// `WWW-Authenticate: Bearer error="invalid_token"` and no body for an
// expired one; on 2026-11-26 its gateway answered a bad token, and a call
// with none, a bare 401 in plain text (`unauthorized`, `server: API
// Gateway`), no header and no envelope. Either is the token: Snap's
// application never saw the call.
const namesInvalidToken = (response: HttpClientResponse.HttpClientResponse) =>
  (response.headers["www-authenticate"] ?? "").includes("invalid_token");

/**
 * What Snap's refusal of a call means, from its status, its
 * `WWW-Authenticate` header and whether the body is Snap's envelope, never
 * from its messages:
 *
 * - 5xx: Snap down, for now (the Spotlight's own call reads a 5xx before
 *   this, as it may have made the post).
 * - 429: a rate limit, for as long as `Retry-After` says when it does.
 * - 401 naming `invalid_token`, or a 401 that is not Snap's envelope (its
 *   gateway's bare `unauthorized`): the token, which a renewal replaces,
 *   and a second refusal asks to reconnect. A 401 in Snap's envelope
 *   without the header is Snap refusing for a reason of its own, which a
 *   second refusal must not turn into "reconnect".
 * - 403 in Snap's envelope: a permission or the allowlist, which no new
 *   token of the same sign-in changes; without it (Snap answered an
 *   app not yet allowlisted a 403 with an empty body), unavailable, never
 *   the channel's.
 * - Snap's envelope with a code starting `MEDIA_`, on any call, or any code
 *   on a part or the finalizing: the media refused.
 * - Snap's envelope with another code: the post refused (a profile gone, a
 *   field it does not take).
 * - Anything else: `http<status>`.
 *
 * A code is kept only when it is a plain identifier, else `refused`.
 */
export const refusalOf = (
  response: HttpClientResponse.HttpClientResponse,
  call: SnapchatCall
): Effect.Effect<SnapchatRefusal> =>
  Effect.gen(function* refusing() {
    const { status } = response;

    if (status >= 500) {
      return new PlatformUnavailable();
    }

    if (status === 429) {
      const now = yield* DateTime.now;

      return Option.match(retryAfterOf(response.headers, now), {
        onNone: () => new RateLimited({}),
        onSome: (retryAfter) => new RateLimited({ retryAfter }),
      });
    }

    if (status === 401 && namesInvalidToken(response)) {
      return new TokenRejected();
    }

    const envelope = yield* snapchatEnvelopeOf(response);

    if (Option.isNone(envelope)) {
      if (status === 401) {
        return new TokenRejected();
      }

      return status === 403
        ? new PlatformUnavailable()
        : new BadRequest({ code: `http${status}` });
    }

    const code = `snapchat:${Option.getOrElse(
      plainErrorCodeOf(envelope.value),
      () => "refused"
    )}`;

    if (status === 401 || status === 403) {
      return new BadRequest({ code });
    }

    return code.startsWith("snapchat:MEDIA_") || call === "upload"
      ? new MediaRejected({ code })
      : new BadRequest({ code });
  });

/** Fails with what Snap's refusal means. */
export const refused = (
  response: HttpClientResponse.HttpClientResponse,
  call: SnapchatCall
): Effect.Effect<never, SnapchatRefusal> =>
  refusalOf(response, call).pipe(Effect.flatMap(Effect.fail));
