import { Duration, Match } from "effect";

import { refuse } from "#app/mcp/refusals.ts";
import type { CreatorFailure } from "#publishing/application/tiktok-creators.ts";
import type { UnknownChannels } from "#publishing/application/unknown-channels.ts";
import { channelRefusalOf } from "#publishing/domain/own-refusals.ts";

// Why get_tiktok_creator got no creator, in words the user acts on: a
// channel that is none of the workspace's TikTok channels, one turned off
// or to reconnect, TikTok not answering, or TikTok asking to slow down.

const notTikTok =
  "This is not one of the workspace's TikTok channels: list_channels answers them.";

const unanswered =
  "TikTok did not answer, or refused to tell the creator's settings: try again in a few minutes.";

/** What get_tiktok_creator answers when the creator could not be read. */
export const tiktokCreatorRefusalText = (
  failure: CreatorFailure | UnknownChannels
): string =>
  Match.valueTags(failure, {
    BadRequest: ({ code }) =>
      Match.value(channelRefusalOf(code)).pipe(
        Match.when(
          "disabled",
          () =>
            "This channel is turned off: enable_channel turns it back on, to post to it."
        ),
        Match.when("disconnected", () => notTikTok),
        Match.when("other", () => unanswered),
        Match.exhaustive
      ),
    PlatformUnavailable: () => unanswered,
    RateLimited: ({ retryAfter }) =>
      retryAfter === undefined
        ? "TikTok asked to slow down, or an allowance of the day is spent: try again later."
        : `TikTok asked to slow down: try again in ${String(Math.ceil(Duration.toSeconds(retryAfter)))} seconds.`,
    TokenExpired: () =>
      "The channel must be reconnected, in the web app, before TikTok tells its settings: TikTok no longer takes its sign-in, or it lacks a permission.",
    UnknownChannels: () => notTikTok,
  });

/** get_tiktok_creator's refusal, in the words above. */
export const tiktokRefusal = (failure: CreatorFailure | UnknownChannels) =>
  refuse(tiktokCreatorRefusalText(failure));
