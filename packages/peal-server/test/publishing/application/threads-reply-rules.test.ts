import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { AccountRules } from "#publishing/application/account-rules.ts";
import { AccountStandings } from "#publishing/application/account-standings.ts";
import { ChannelGrants } from "#publishing/application/channel-grants.ts";
import { PlatformLookups } from "#publishing/application/platform-lookups.ts";
import { TikTokCreators } from "#publishing/application/tiktok-creators.ts";
import type { ChannelOnPlatform } from "#publishing/domain/content-rules.ts";
import { ThreadsOptions } from "#publishing/domain/threads-options.ts";
import { threadsRepliesScope } from "#publishing/domain/threads-reply-control.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";

// What a post may say on Threads, and what it needs of the channel's
// scopes: who may reply needs threads_manage_replies, which channels
// connected before Peal asked for it lack.
const threads: ChannelOnPlatform = {
  channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000002"),
  platform: "threads",
};

const before = ["threads_basic", "threads_content_publish"];

const rulesOn = (grants: Layer.Layer<ChannelGrants>) =>
  AccountRules.layer.pipe(
    Layer.provide(grants),
    Layer.provide(
      Layer.succeed(
        TikTokCreators,
        TikTokCreators.of({
          read: () => Effect.die("TikTok is not asked"),
          takesPhotos: true,
        })
      )
    )
  );

const standingsOn = (grants: Layer.Layer<ChannelGrants>) =>
  AccountStandings.layer.pipe(
    Layer.provide(grants),
    Layer.provide(
      Layer.succeed(
        PlatformLookups,
        PlatformLookups.of({ run: () => Effect.die("no lookup is run") })
      )
    )
  );

const scheduling = (
  grants: Layer.Layer<ChannelGrants>,
  replyControl: ThreadsOptions["replyControl"]
) =>
  AccountRules.use((rules) =>
    rules.violationsOn({
      channel: threads,
      files: [],
      followUps: 0,
      options: Option.some(new ThreadsOptions({ replyControl })),
    })
  ).pipe(Effect.provide(rulesOn(grants)));

const standing = (grants: Layer.Layer<ChannelGrants>) =>
  AccountStandings.use((standings) => standings.read(threads)).pipe(
    Effect.provide(standingsOn(grants))
  );

describe("who may reply on a Threads channel", () => {
  it.effect(
    "is refused at scheduling where the channel did not grant threads_manage_replies",
    () =>
      Effect.gen(function* refused() {
        assert.deepStrictEqual(
          yield* scheduling(ChannelGrants.granting(before), "followers_only"),
          [{ _tag: "optionInvalid", ...threads, field: "replyControl" }]
        );
        // Everyone is Threads' default, which Peal does not send.
        assert.deepStrictEqual(
          yield* scheduling(ChannelGrants.granting(before), "everyone"),
          []
        );
        assert.deepStrictEqual(
          yield* scheduling(
            ChannelGrants.granting([...before, threadsRepliesScope]),
            "followers_only"
          ),
          []
        );
        // Scopes Peal cannot read let the post through: Threads decides.
        assert.deepStrictEqual(
          yield* scheduling(ChannelGrants.none, "followers_only"),
          []
        );
      })
  );

  it.effect("says beforehand that it needs the channel connected again", () =>
    Effect.gen(function* said() {
      assert.deepStrictEqual(yield* standing(ChannelGrants.granting(before)), {
        _tag: "read",
        blocked: undefined,
        restrictions: [{ _tag: "optionNeedsReconnect", field: "replyControl" }],
      });
      assert.deepStrictEqual(
        yield* standing(
          ChannelGrants.granting([...before, threadsRepliesScope])
        ),
        { _tag: "unrestricted" }
      );
    })
  );
});
