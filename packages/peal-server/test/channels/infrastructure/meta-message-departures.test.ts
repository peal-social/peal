import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Redacted } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelDirectory } from "#channels/application/channel-directory.ts";
import type { AccountListedChannel } from "#channels/application/channel-directory.ts";
import { Channel } from "#channels/domain/channel.ts";
import { metaMessageDepartures } from "#channels/infrastructure/platforms/meta/meta-message-departures.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
} from "#shared/domain/inbox-message-platform.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { metaApp } from "#test/channels/fakes/fake-meta.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import { fakeMetaMessages } from "#test/engagement/fakes/fake-meta-messages.ts";
import {
  facebookPageId,
  instagramUserId,
} from "#test/publishing/fakes/fake-meta-graph.ts";

// A channel disconnected takes its account's message events with it: the
// app's subscription is stopped once no other channel of Peal's reads the
// messages of an account it carries (the Page, or the Instagram account
// linked to it), and only where the inbox reads that platform's messages.

const at = DateTime.makeUnsafe("2026-11-16T10:00:00.000Z");

const workspaceId = WorkspaceIdSchema.make(
  "01900000-0000-7000-8000-0000000000a1"
);

const departingId = ChannelIdSchema.make(
  "01900000-0000-7000-8000-0000000000a2"
);

const otherId = ChannelIdSchema.make("01900000-0000-7000-8000-0000000000a3");

const channelOf = (
  platform: "facebook" | "instagram",
  scopes: readonly string[],
  connection: "facebookLogin" | "instagramLogin" = "facebookLogin"
) =>
  new Channel({
    accountId: platform === "facebook" ? facebookPageId : instagramUserId,
    avatarUrl: Option.none(),
    connection:
      platform === "instagram" ? Option.some(connection) : Option.none(),
    createdAt: at,
    displayName: Option.none(),
    handle: "@synthetic_studio",
    id: departingId,
    platform,
    scopes,
    status: { _tag: "active" },
    token: { _tag: "nonExpiring" },
    updatedAt: at,
    workspaceId,
  });

const tokens = {
  accessToken: Redacted.make("synthetic-token-1"),
  refreshToken: Option.none(),
};

// The departures against a fake Graph, with `others` the other channels
// of each account, and `reading` those of them with a box.
const departures = Effect.fnUntraced(function* departures(options: {
  readonly instagramLogin?: boolean;
  readonly messages?: InboxMessagePlatforms;
  readonly others?: Readonly<
    Record<
      string,
      readonly {
        readonly channelId: ChannelId;
        readonly connection?: "facebookLogin" | "instagramLogin";
      }[]
    >
  >;
  readonly reading?: readonly ChannelId[];
}) {
  const instagramLogin = options.instagramLogin === true;

  const graph = yield* fakeMetaMessages(["synthetic-token-1"], {
    instagramLogin,
    linkedInstagram: instagramUserId,
    me: instagramLogin ? instagramUserId : facebookPageId,
  });

  const url = new URL(graph.url);
  const asked: string[] = [];
  const refollowed: ChannelId[] = [];

  const directory = Layer.succeed(
    ChannelDirectory,
    ChannelDirectory.of({
      after: () => Effect.succeed([]),
      withAccount: (platform, accountId) => {
        asked.push(`${platform}:${accountId}`);

        return Effect.succeed(
          (options.others?.[`${platform}:${accountId}`] ?? []).map(
            ({ channelId, connection }): AccountListedChannel => ({
              channelId,
              connection:
                platform === "instagram"
                  ? Option.some(connection ?? "facebookLogin")
                  : Option.none(),
              platform,
              workspaceId,
            })
          )
        );
      },
    })
  );

  const records = Layer.succeed(
    EngagementRecords,
    EngagementRecords.of({
      channelGone: () => Effect.void,
      ensureChannelIdle: () => Effect.void,
      eraseWorkspace: () => Effect.void,
      exportCommentRules: () => Effect.succeed([]),
      exportUser: () => Effect.succeed([]),
      exportUserMessages: () => Effect.succeed([]),
      exportUserPrivateReplies: () => Effect.succeed([]),
      exportUserReviewReplies: () => Effect.succeed([]),
      forgetUser: () => Effect.void,
      postRemoved: () => Effect.void,
      readsMessages: (channelIds) =>
        Effect.succeed(
          channelIds.some((id) => (options.reading ?? []).includes(id))
        ),
      refollow: (channelIds) =>
        Effect.sync(() => {
          refollowed.push(...channelIds);
        }),
    })
  );

  const layer = metaMessageDepartures({
    hosts: { ...metaHosts, facebookGraph: url, instagramGraph: url },
    http: yield* publicHttpClient,
    mainApp: Option.some(metaApp),
    messages: options.messages ?? new Set(["facebook", "instagram"]),
  }).pipe(
    Layer.provide(
      Layer.mergeAll(
        directory,
        records,
        Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
      )
    )
  );

  return { asked, graph, layer, refollowed };
});

const depart = (
  channel: Channel,
  layer: Layer.Layer<ChannelDepartures>,
  leaving: readonly ChannelId[] = []
) =>
  ChannelDepartures.use((service) =>
    service.departed(channel, tokens, leaving)
  ).pipe(Effect.provide(layer));

const Services = Layer.mergeAll(
  FetchHttpClient.layer,
  OpenOutboundGuard,
  Mac.layerWebCrypto
).pipe(Layer.provideMerge(SecureRandom.layerWebCrypto));

describe("a Meta channel disconnected", () => {
  it.effect("stops its Page's events once nobody else reads them", () =>
    Effect.gen(function* stopped() {
      const on = yield* departures({});

      yield* depart(
        channelOf("facebook", ["pages_show_list", ...facebookMessageScopes]),
        on.layer
      );

      // Asked once to check, once to tell the others to follow again.
      assert.deepStrictEqual(
        [...new Set(on.asked)],
        [`facebook:${facebookPageId}`, `instagram:${instagramUserId}`]
      );
      assert.isTrue(
        on.graph
          .requests()
          .some(
            ({ method, path }) =>
              method === "DELETE" && path === "/v27.0/me/subscribed_apps"
          )
      );
    }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "keeps them while the Instagram account linked to the Page is read",
    () =>
      Effect.gen(function* kept() {
        const on = yield* departures({
          others: {
            [`instagram:${instagramUserId}`]: [{ channelId: otherId }],
          },
          reading: [otherId],
        });

        yield* depart(
          channelOf("facebook", ["pages_show_list", ...facebookMessageScopes]),
          on.layer
        );

        assert.isFalse(
          on.graph.requests().some(({ method }) => method === "DELETE")
        );
      }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "stops them when the Instagram account linked to the Page leaves with it, as an erased workspace's do",
    () =>
      Effect.gen(function* together() {
        // The Page's linked Instagram account has a box in the same
        // workspace: each of the two would keep the subscription for the
        // other, unless both are counted as leaving.
        const on = yield* departures({
          others: {
            [`instagram:${instagramUserId}`]: [{ channelId: otherId }],
          },
          reading: [otherId],
        });

        yield* depart(
          channelOf("facebook", ["pages_show_list", ...facebookMessageScopes]),
          on.layer,
          [otherId]
        );

        assert.isTrue(
          on.graph
            .requests()
            .some(
              ({ method, path }) =>
                method === "DELETE" && path === "/v27.0/me/subscribed_apps"
            )
        );
        assert.deepStrictEqual(on.refollowed, []);
      }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "asks nothing where the inbox reads no Meta messages, or of a channel that never granted them",
    () =>
      Effect.gen(function* nothing() {
        const off = yield* departures({ messages: new Set(["mastodon"]) });

        yield* depart(
          channelOf("facebook", ["pages_show_list", ...facebookMessageScopes]),
          off.layer
        );

        const posting = yield* departures({});

        yield* depart(
          channelOf("facebook", ["pages_show_list"]),
          posting.layer
        );

        assert.lengthOf(off.graph.requests(), 0);
        assert.lengthOf(posting.graph.requests(), 0);
      }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect("stops an Instagram Login account's own, without proof", () =>
    Effect.gen(function* own() {
      const on = yield* departures({ instagramLogin: true });

      yield* depart(
        channelOf(
          "instagram",
          ["instagram_business_basic", instagramLoginMessageScope],
          "instagramLogin"
        ),
        on.layer
      );

      // Asked once to check, once to tell the others to follow again.
      assert.deepStrictEqual(
        [...new Set(on.asked)],
        [`instagram:${instagramUserId}`]
      );

      const [stop] = on.graph.requests();

      assert.strictEqual(stop?.method, "DELETE");
      assert.isFalse(stop?.query.has("appsecret_proof"));
    }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "tells the other channels of what it carried to follow again once stopped",
    () =>
      Effect.gen(function* refollow() {
        // A channel of the Page in another workspace, turned on since the
        // check: its own subscription was just deleted with this one.
        const on = yield* departures({
          others: { [`facebook:${facebookPageId}`]: [{ channelId: otherId }] },
        });

        yield* depart(
          channelOf("facebook", ["pages_show_list", ...facebookMessageScopes]),
          on.layer
        );

        assert.deepStrictEqual(on.refollowed, [otherId]);
      }).pipe(Effect.scoped, Effect.provide(Services))
  );

  it.effect(
    "stops an Instagram Login account's own though a channel through its Page reads it",
    () =>
      Effect.gen(function* apart() {
        const on = yield* departures({
          instagramLogin: true,
          others: {
            [`instagram:${instagramUserId}`]: [
              { channelId: otherId, connection: "facebookLogin" },
            ],
          },
          reading: [otherId],
        });

        yield* depart(
          channelOf(
            "instagram",
            ["instagram_business_basic", instagramLoginMessageScope],
            "instagramLogin"
          ),
          on.layer
        );

        assert.isTrue(
          on.graph.requests().some(({ method }) => method === "DELETE")
        );
        assert.deepStrictEqual(on.refollowed, []);
      }).pipe(Effect.scoped, Effect.provide(Services))
  );
});
