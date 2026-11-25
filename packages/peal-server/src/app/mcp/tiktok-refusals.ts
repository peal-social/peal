import { Duration, Match } from "effect";

import { refuse } from "#app/mcp/refusals.ts";
import type { CreatorFailure } from "#publishing/application/tiktok-creators.ts";
import type { UnknownChannels } from "#publishing/application/unknown-channels.ts";
import {
  channelRefusalOf,
  readRefusedCode,
} from "#publishing/domain/own-refusals.ts";

// Why get_tiktok_creator got no creator, in words the user acts on: a
// channel that is none of the workspace's TikTok channels, one turned off
// or to reconnect, TikTok not answering, TikTok refusing in a way it may
// repeat, or TikTok asking to slow down.

const notTikTok =
  "This is not one of the workspace's TikTok channels: list_channels answers them.";

const unanswered = "TikTok did not answer: try again in a few minutes.";

// A refusal that may come back the same each time (an app TikTok has not
// audited, a host this server's guard refuses): an agent must not loop.
const repeated =
  "TikTok refused to tell this creator's settings, or this server would not reach TikTok: trying again may not help. If it keeps failing, the server's operator must look at the server's logs.";

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
        Match.when("other", () => repeated),
        Match.exhaustive
      ),
    PlatformUnavailable: ({ code }) =>
      code === readRefusedCode ? repeated : unanswered,
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
