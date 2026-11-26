import { describe, expect, it } from "@effect/vitest";

import { followUpSupport } from "#publishing/domain/follow-ups/follow-up-support.ts";
import { followUpsOnPlatforms } from "#publishing/domain/follow-ups/platform-follow-ups.ts";
import type { FollowUpServer } from "#publishing/domain/follow-ups/platform-follow-ups.ts";
import { platforms } from "#shared/domain/platform.ts";
import type { Platform } from "#shared/domain/platform.ts";

// Where a follow-up rule can act on each platform, on a server that sends
// later parts and counts likes where a test says.

const server = (
  options: {
    readonly uncounted?: readonly Platform[];
    readonly withoutParts?: readonly Platform[];
  } = {}
): FollowUpServer => ({
  counts: (platform) => !(options.uncounted ?? []).includes(platform),
  takesParts: (platform) => !(options.withoutParts ?? []).includes(platform),
});

const byPlatform = (on: FollowUpServer) =>
  new Map(
    followUpsOnPlatforms(on).map(({ platform, ...support }) => [
      platform,
      support,
    ])
  );

describe("where follow-up rules act", () => {
  it("names every platform once, in Peal's order", () => {
    expect(
      followUpsOnPlatforms(server()).map(({ platform }) => platform)
    ).toStrictEqual(platforms);
  });

  it("answers the platforms' own support where the server sends and counts everything", () => {
    const answered = byPlatform(server());

    for (const platform of platforms) {
      expect(answered.get(platform)).toStrictEqual(followUpSupport[platform]);
    }

    expect(answered.get("youtube")).toStrictEqual({
      comment: "notBuilt",
      repost: "noApi",
    });
    expect(answered.get("bluesky")).toStrictEqual({
      comment: "available",
      repost: "available",
    });
  });

  it("says a comment is turned off where the server sends no later part, and the repost stays", () => {
    expect(byPlatform(server({ withoutParts: ["x"] })).get("x")).toStrictEqual({
      comment: "turnedOff",
      repost: "notBuilt",
    });
    expect(
      byPlatform(server({ withoutParts: ["mastodon"] })).get("mastodon")
    ).toStrictEqual({ comment: "turnedOff", repost: "available" });
  });

  it("acts nowhere the server counts no likes, after the platform's own reason", () => {
    expect(byPlatform(server({ uncounted: ["x"] })).get("x")).toStrictEqual({
      comment: "notCounted",
      repost: "notBuilt",
    });
    expect(
      byPlatform(server({ uncounted: ["bluesky"] })).get("bluesky")
    ).toStrictEqual({ comment: "notCounted", repost: "notCounted" });
    expect(
      byPlatform(server({ uncounted: ["linkedin"] })).get("linkedin")
    ).toStrictEqual({ comment: "notAllowed", repost: "notAllowed" });
  });
});
