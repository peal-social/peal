import { Effect, Match } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  ChannelCannotPost,
  ChannelNotFound,
  CurrentMember,
  PlatformRateLimited,
  PlatformUnreachable,
} from "peal-contract";

import { TikTokCreatorInfo } from "#publishing/application/tiktok-creator-info.ts";
import { channelRefusalOf } from "#publishing/domain/own-refusals.ts";
import { actorOf } from "#shared/api/actor.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import type { BadRequest } from "#shared/domain/bad-request.ts";
import { storableLine } from "#shared/domain/platform-text.ts";
import type { RateLimited } from "#shared/domain/rate-limited.ts";

import { retryAfterSecondsOf } from "./lookups.ts";
import { tiktokAccountView } from "./tiktok-account-view.ts";

// TikTok did not answer, or refused the read: logged, then 502.
const unreachable = (failure: { readonly _tag: string }) =>
  Effect.logWarning("TikTok's creator info could not be read").pipe(
    Effect.annotateLogs({ failure: failure._tag }),
    Effect.andThen(Effect.fail(new PlatformUnreachable()))
  );

// TikTok asked to slow down, or a cap of the day is spent: logged, then
// 429 with the wait it asked for.
const slowDown = (limited: RateLimited) =>
  Effect.logWarning("TikTok rate limited a read of creator info").pipe(
    Effect.andThen(
      Effect.fail(
        new PlatformRateLimited({
          retryAfterSeconds: retryAfterSecondsOf(limited),
        })
      )
    )
  );

// The channel turned off, or disconnected while it was read; any other
// refusal is none of the channel's, and never a missing channel.
const refused = (failure: BadRequest) =>
  Match.value(channelRefusalOf(failure.code)).pipe(
    Match.when("disabled", () =>
      Effect.fail(new ChannelCannotPost({ reason: "disabled" }))
    ),
    Match.when("disconnected", () => Effect.fail(new ChannelNotFound())),
    Match.when("other", () =>
      unreachable(failure).pipe(
        Effect.annotateLogs({ code: storableLine(failure.code, 64) })
      )
    ),
    Match.exhaustive
  );

export const TikTokHandlers = HttpApiBuilder.group(
  Api,
  "channels.tiktokCreator",
  Effect.fn(function* tiktokHandlers(handlers) {
    const info = yield* TikTokCreatorInfo;

    return handlers.handleAll({
      get: ({ params }) =>
        Effect.gen(function* creator() {
          const actor = actorOf(yield* CurrentMember);

          const account = yield* info.read(actor, params.channelId).pipe(
            Effect.catch((error) =>
              Match.valueTags(error, {
                BadRequest: refused,
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
                PlatformUnavailable: unreachable,
                RateLimited: slowDown,
                TokenExpired: () =>
                  Effect.fail(new ChannelCannotPost({ reason: "reconnect" })),
                UnknownChannels: () => Effect.fail(new ChannelNotFound()),
              })
            )
          );

          return tiktokAccountView(account);
        }),
    });
  })
);
