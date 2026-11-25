import { describe, expect, it } from "@effect/vitest";
import { Duration } from "effect";

import { tiktokCreatorRefusalText } from "#app/mcp/tiktok-refusals.ts";
import { UnknownChannels } from "#publishing/application/unknown-channels.ts";
import {
  ownRefusalCodes,
  readRefusedCode,
} from "#publishing/domain/own-refusals.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";

const notTikTok =
  "This is not one of the workspace's TikTok channels: list_channels answers them.";

describe(tiktokCreatorRefusalText, () => {
  it("tells a channel that is none of the workspace's TikTok channels", () => {
    expect(
      tiktokCreatorRefusalText(
        new UnknownChannels({ channelIds: ["not-a-channel"] })
      )
    ).toBe(notTikTok);
    expect(
      tiktokCreatorRefusalText(
        new BadRequest({ code: ownRefusalCodes.channelDisconnected })
      )
    ).toBe(notTikTok);
  });

  it("tells a channel turned off from one to reconnect", () => {
    expect(
      tiktokCreatorRefusalText(
        new BadRequest({ code: ownRefusalCodes.channelDisabled })
      )
    ).toBe(
      "This channel is turned off: enable_channel turns it back on, to post to it."
    );
    expect(tiktokCreatorRefusalText(new TokenExpired())).toBe(
      "The channel must be reconnected, in the web app, before TikTok tells its settings: TikTok no longer takes its sign-in, or it lacks a permission."
    );
  });

  it("tells TikTok unavailable apart from a refusal it may repeat, and from TikTok asking to slow down", () => {
    expect(tiktokCreatorRefusalText(new PlatformUnavailable())).toBe(
      "TikTok did not answer: try again in a few minutes."
    );

    const repeated =
      "TikTok refused to tell this creator's settings, or this server would not reach TikTok: trying again may not help. If it keeps failing, the server's operator must look at the server's logs.";

    expect(
      tiktokCreatorRefusalText(
        new PlatformUnavailable({ code: readRefusedCode })
      )
    ).toBe(repeated);
    expect(
      tiktokCreatorRefusalText(new BadRequest({ code: "hostNotAllowed" }))
    ).toBe(repeated);
    expect(
      tiktokCreatorRefusalText(
        new RateLimited({ retryAfter: Duration.millis(29_500) })
      )
    ).toBe("TikTok asked to slow down: try again in 30 seconds.");
    expect(tiktokCreatorRefusalText(new RateLimited({}))).toBe(
      "TikTok asked to slow down, or an allowance of the day is spent: try again later."
    );
  });
});
