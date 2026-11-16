import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { ChannelAccess } from "#channels/application/channel-access.ts";
import { EngagementChannels } from "#engagement/application/ports/engagement-channels.ts";
import { AccessEngagementChannels } from "#engagement/infrastructure/access-engagement-channels.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";

// The channels as engagement sees them: one whose token ran out says its
// platform, so what it could do after a reconnect can be told.

const channelId = ChannelIdSchema.make("01900000-0000-7000-8000-0000000000f3");

const expiredOn = Layer.succeed(
  ChannelAccess,
  ChannelAccess.of({
    account: () => Effect.fail(new TokenExpired()),
    platformOf: () => Effect.succeed(Option.some("facebook" as const)),
    withSiteToken: () => Effect.die("No website here"),
    withToken: () => Effect.die("No call here"),
    workspaceOf: () => Effect.succeed(Option.none()),
  })
);

describe("engagement's channels", () => {
  it.effect("name the platform of a channel whose token ran out", () =>
    Effect.gen(function* expired() {
      const refused = yield* EngagementChannels.use((channels) =>
        channels.describe(channelId)
      ).pipe(Effect.flip);

      assert.strictEqual(refused._tag, "ChannelUnreadable");
      assert.deepStrictEqual(
        refused._tag === "ChannelUnreadable"
          ? [refused.reason, refused.platform]
          : [],
        ["paused", "facebook"]
      );
    }).pipe(
      Effect.provide(AccessEngagementChannels.pipe(Layer.provide(expiredOn)))
    )
  );
});
