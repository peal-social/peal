import { assert, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option, Redacted } from "effect";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { SqlClient } from "effect/sql";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { CurrentHumanAgent } from "#engagement/application/current-human-agent.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";
import { MessageSender } from "#engagement/application/ports/message-sender.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { ConversationIdSchema } from "#engagement/domain/conversation-id.ts";
import {
  refreshConversation,
  startConversation,
} from "#engagement/domain/conversation.ts";
import { DirectMessageIdSchema } from "#engagement/domain/direct-message-id.ts";
import { receiveMessage } from "#engagement/domain/direct-message.ts";
import { followBox } from "#engagement/domain/message-box.ts";
import { OutgoingMessageIdSchema } from "#engagement/domain/outgoing-message-id.ts";
import { writeMessage } from "#engagement/domain/outgoing-message.ts";
import { DrizzleEngagementStore } from "#engagement/infrastructure/drizzle-engagement-store.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { DrizzlePrivateReplyStore } from "#engagement/infrastructure/drizzle-private-reply-store.ts";
import { platformMessagesWith } from "#engagement/infrastructure/platforms/platform-messages.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { CurrentInboxPlatforms } from "#shared/application/current-inbox-platforms.ts";
import { newId } from "#shared/application/ids.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
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
  conversationReading,
  messageReading,
} from "#test/engagement/support.ts";
import {
  facebookPageId,
  graphAppSecret,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import { textOf } from "#test/publishing/fakes/platform-server.ts";
import type { PlatformRequest } from "#test/publishing/fakes/platform-server.ts";

// What the channel's gate hands Meta for a direct message, between the
// real engagement tables and a loopback Graph: the Human Agent tag only
// for a member's own answer, on a server whose Meta app holds the
// feature. On Postgres, at instants no other suite uses (2053), on the
// live clock.

const StoreTest = Layer.mergeAll(
  DrizzleMessageStore,
  DrizzleEngagementStore,
  DrizzlePrivateReplyStore
).pipe(Layer.provideMerge(DatabaseTest));

const at = DateTime.makeUnsafe("2053-05-02T10:00:00.000Z");

const token = "synthetic-token-1";

const forget = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use((sql) =>
    Effect.all([
      sql`DELETE FROM engagement.conversations WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`,
    ])
  ).pipe(Effect.orDie);

const pageAccount = (
  channelId: ChannelAccount["channelId"]
): ChannelAccount => ({
  accountId: facebookPageId,
  channelId,
  connection: Option.none(),
  platform: "facebook",
  scopes: ["pages_show_list", ...facebookMessageScopes],
});

// A Page's conversation with reader 7001, who last wrote `ago` before
// now (the live clock), its messages on, and an answer journalled
// `written` before now: by a member in person, or not.
const journalled = Effect.fn("journalled")(function* journalled(
  workspaceId: WorkspaceId,
  byPerson: boolean,
  ago: Duration.Input = "2 days",
  written: Duration.Input = "1 minute"
) {
  const now = yield* DateTime.now;
  const lastIncoming = DateTime.subtractDuration(now, ago);
  const store = yield* MessageStore;
  const channelId = yield* newId(ChannelIdSchema);
  const box = followBox({ channelId, workspaceId }, at);

  yield* store.switchOn(
    { channelId, enabledAt: at, enabledBy: Option.none(), workspaceId },
    box
  );

  const reading = conversationReading(1, {
    lastMessageAt: lastIncoming,
    messages: [messageReading(1, { sentAt: lastIncoming })],
    platformConversationId: "c_1",
  });

  const started = startConversation(
    yield* newId(ConversationIdSchema),
    box,
    reading,
    at
  );

  // The person's message, read: what the window counts from.
  const talk = refreshConversation(
    started,
    reading,
    [
      receiveMessage(
        yield* newId(DirectMessageIdSchema),
        started,
        messageReading(1, { sentAt: lastIncoming }),
        at
      ),
    ],
    at
  );

  yield* store.saveConversations([talk]);

  const message = writeMessage(
    yield* newId(OutgoingMessageIdSchema),
    talk,
    Option.none(),
    "Back on Monday, sorry for the wait",
    DateTime.subtractDuration(now, written),
    byPerson
  );

  yield* store.journalMessage(message, Option.none());

  return { channelId, message };
});

// The gate's direct messages for `account`, on a loopback Graph that
// holds the conversation, with Meta's Human Agent feature on or off here.
const gateFor = Effect.fnUntraced(function* gateFor(
  account: ChannelAccount,
  humanAgent: boolean
) {
  const graph = yield* fakeMetaMessages([token], {
    humanAgent: true,
    me: facebookPageId,
    now: "2053-05-02T10:00:05+0000",
  });

  graph.add({
    id: "c_1",
    messages: [
      {
        createdTime: "2053-05-02T10:00:00+0000",
        from: { id: "7001", name: "Reader 1" },
        id: "m1",
        text: "Message 1",
      },
    ],
    participants: [
      { id: "7001", name: "Reader 1" },
      { id: facebookPageId, name: "Synthetic Page" },
    ],
    platform: "messenger",
    updatedTime: "2053-05-02T10:00:00+0000",
  });

  const url = new URL(graph.url);

  const sender = yield* MessageSender.pipe(
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
            Layer.succeed(CurrentHumanAgent, humanAgent),
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

  return { graph, sender };
});

// How the one message was sent: its type and its tag.
const sentAs = (graph: {
  readonly requests: () => readonly PlatformRequest[];
}) => {
  const post = graph.requests().find(({ method }) => method === "POST");
  const params = new URLSearchParams(post === undefined ? "" : textOf(post));

  return { tag: params.get("tag"), type: params.get("messaging_type") };
};

layer(StoreTest, { excludeTestServices: true })(
  "the gate's direct messages",
  (it) => {
    it.effect(
      "tag a member's own answer with Meta's Human Agent tag where the app holds it",
      () =>
        Effect.gen(function* tagged() {
          const workspaceId = yield* freshWorkspace;

          yield* Effect.gen(function* checks() {
            const { channelId, message } = yield* journalled(workspaceId, true);

            const { graph, sender } = yield* gateFor(
              pageAccount(channelId),
              true
            );

            assert.deepStrictEqual(
              yield* sender.send({ channelId, messageId: message.id }),
              { _tag: "sent", platformMessageId: "m_sent_1" }
            );
            assert.deepStrictEqual(sentAs(graph), {
              tag: "HUMAN_AGENT",
              type: "MESSAGE_TAG",
            });
          }).pipe(Effect.ensuring(forget(workspaceId)));
        })
    );

    it.effect(
      "send a member's own answer within the 24 hours as a response, untagged, and tag it only past them",
      () =>
        Effect.gen(function* windowed() {
          for (const [ago, written, tagged] of [
            ["1 hour", "1 minute", false],
            [
              Duration.sum(Duration.hours(23), Duration.minutes(57)),
              "1 minute",
              false,
            ],
            // Written at 23 h 58, inside the 24 hours, and sent at 24 h 01:
            // the gate reads the window at the call.
            [
              Duration.sum(Duration.hours(24), Duration.minutes(1)),
              "3 minutes",
              true,
            ],
            ["2 days", "1 minute", true],
          ] as const) {
            const workspaceId = yield* freshWorkspace;

            yield* Effect.gen(function* checks() {
              const { channelId, message } = yield* journalled(
                workspaceId,
                true,
                ago,
                written
              );

              const { graph, sender } = yield* gateFor(
                pageAccount(channelId),
                true
              );

              yield* sender.send({ channelId, messageId: message.id });

              assert.deepStrictEqual(
                sentAs(graph),
                tagged
                  ? { tag: "HUMAN_AGENT", type: "MESSAGE_TAG" }
                  : { tag: null, type: "RESPONSE" }
              );
            }).pipe(Effect.ensuring(forget(workspaceId)));
          }
        })
    );

    it.effect(
      "never tag a message no person wrote in their session, nor where the app lacks the feature",
      () =>
        Effect.gen(function* untagged() {
          for (const [byPerson, humanAgent] of [
            [false, true],
            [true, false],
          ] as const) {
            const workspaceId = yield* freshWorkspace;

            yield* Effect.gen(function* checks() {
              const { channelId, message } = yield* journalled(
                workspaceId,
                byPerson
              );

              const { graph, sender } = yield* gateFor(
                pageAccount(channelId),
                humanAgent
              );

              yield* sender.send({ channelId, messageId: message.id });

              assert.deepStrictEqual(sentAs(graph), {
                tag: null,
                type: "RESPONSE",
              });
            }).pipe(Effect.ensuring(forget(workspaceId)));
          }
        })
    );
  }
);
