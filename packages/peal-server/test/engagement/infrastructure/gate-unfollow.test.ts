import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Redacted } from "effect";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { SqlClient } from "effect/sql";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";
import { MessageSource } from "#engagement/application/ports/message-source.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { followBox } from "#engagement/domain/message-box.ts";
import { DrizzleEngagementStore } from "#engagement/infrastructure/drizzle-engagement-store.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { DrizzlePrivateReplyStore } from "#engagement/infrastructure/drizzle-private-reply-store.ts";
import { platformMessagesWith } from "#engagement/infrastructure/platforms/platform-messages.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { CurrentInboxPlatforms } from "#shared/application/current-inbox-platforms.ts";
import { newId } from "#shared/application/ids.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";
import { facebookMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { channelAccessOf } from "#test/analytics/access-log.ts";
import {
  DatabaseTest,
  freshWorkspace,
  OpenOutboundGuard,
} from "#test/channels/support.ts";
import { fakeMetaMessages } from "#test/engagement/fakes/fake-meta-messages.ts";
import {
  facebookPageId,
  graphAppSecret,
} from "#test/publishing/fakes/fake-meta-graph.ts";

// What the channel's gate runs when a channel's messages are turned off:
// Meta's subscription stopped, between the real engagement tables and a
// loopback Graph. A member who turns them on again at once must not leave
// the new box without events. On Postgres, at instants no other suite uses
// (2049), on the live clock (Meta's calls of one account are half a second
// apart).

const StoreTest = Layer.mergeAll(
  DrizzleMessageStore,
  DrizzleEngagementStore,
  DrizzlePrivateReplyStore
).pipe(Layer.provideMerge(DatabaseTest));

const at = DateTime.makeUnsafe("2049-03-02T10:00:00.000Z");

const token = "synthetic-token-1";

const unsubscribe = "DELETE /v27.0/me/subscribed_apps";

const forget = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use((sql) =>
    Effect.all([
      sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`,
    ])
  ).pipe(Effect.orDie);

const pageAccount = (channelId: ChannelId): ChannelAccount => ({
  accountId: facebookPageId,
  channelId,
  connection: Option.none(),
  platform: "facebook",
  scopes: ["pages_show_list", ...facebookMessageScopes],
});

// The channel's messages turned on, its box followed at `at`.
const turnedOn = (channelId: ChannelId, workspaceId: WorkspaceId) =>
  MessageStore.use((store) =>
    store
      .switchOn(
        { channelId, enabledAt: at, enabledBy: Option.none(), workspaceId },
        followBox({ channelId, workspaceId }, at)
      )
      .pipe(Effect.andThen(store.markFollowed(channelId, at)))
  );

// The gate's subscriptions for `account`, on a loopback Graph.
const gateFor = Effect.fnUntraced(function* gateFor(account: ChannelAccount) {
  const graph = yield* fakeMetaMessages([token], { me: facebookPageId });
  const url = new URL(graph.url);

  const source = yield* MessageSource.pipe(
    Effect.provide(
      Layer.unwrap(
        Effect.gen(function* settings() {
          const http = yield* publicHttpClient;

          return platformMessagesWith({
            http,
            mastodonScheme: "http:",
            metaAppSecret: Option.some(Redacted.make(graphAppSecret)),
            metaHosts: {
              ...metaHosts,
              facebookGraph: url,
              instagramGraph: url,
            },
            reader: http,
          });
        })
      ).pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(
              MessageChannelsOfAccount,
              MessageChannelsOfAccount.of({
                channelsOf: () => Effect.succeed([]),
              })
            ),
            Layer.succeed(CurrentInboxMessages, new Set(["facebook"] as const)),
            Layer.succeed(CurrentInboxPlatforms, new Set<never>()),
            channelAccessOf(account, [token]),
            FetchHttpClient.layer,
            OpenOutboundGuard,
            Digest.layerWebCrypto,
            Mac.layerWebCrypto.pipe(
              Layer.provideMerge(SecureRandom.layerWebCrypto)
            )
          )
        )
      )
    )
  );

  return { graph, source };
});

const deletes = (graph: {
  readonly requests: () => readonly { method: string }[];
}) => graph.requests().filter(({ method }) => method === "DELETE").length;

layer(StoreTest, { excludeTestServices: true })(
  "a channel's messages turned off, then on again",
  (it) => {
    it.effect(
      "keep Meta's events when they were turned on again before the gate's turn",
      () =>
        Effect.gen(function* before() {
          const workspaceId = yield* freshWorkspace;
          const channelId = yield* newId(ChannelIdSchema);

          yield* Effect.gen(function* checks() {
            const { graph, source } = yield* gateFor(pageAccount(channelId));

            // Off, then on again: the new box is there when the switch-off's
            // unfollow takes its turn.
            yield* turnedOn(channelId, workspaceId);

            assert.strictEqual(
              yield* source.unfollow({ channelId }),
              "unneeded"
            );
            assert.strictEqual(deletes(graph), 0);
          }).pipe(Effect.scoped, Effect.ensuring(forget(workspaceId)));
        })
    );

    it.effect(
      "follow again at the new box's next read when they were turned on again while Meta stopped them",
      () =>
        Effect.gen(function* meanwhile() {
          const workspaceId = yield* freshWorkspace;
          const channelId = yield* newId(ChannelIdSchema);

          yield* Effect.gen(function* checks() {
            const { graph, source } = yield* gateFor(pageAccount(channelId));
            const services = yield* Effect.context<MessageStore>();

            // Turned on again, and its box marked followed, while the
            // DELETE was on its way: Meta then stopped the events anyway.
            graph.during(unsubscribe, () =>
              Effect.runPromiseWith(services)(
                turnedOn(channelId, workspaceId).pipe(Effect.orDie)
              )
            );

            yield* source.unfollow({ channelId });

            assert.strictEqual(deletes(graph), 1);

            const box = yield* MessageStore.use((store) =>
              store.box(channelId)
            );

            assert.isTrue(Option.isSome(box));
            assert.isTrue(
              box.pipe(
                Option.map(({ subscribedAt }) => Option.isNone(subscribedAt)),
                Option.getOrElse(() => false)
              )
            );
          }).pipe(Effect.scoped, Effect.ensuring(forget(workspaceId)));
        })
    );
  }
);
