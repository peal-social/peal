import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Redacted, Result } from "effect";
import { Digest, Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { SqlClient } from "effect/sql";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { EngagementStore } from "#engagement/application/ports/engagement-store.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";
import { MessageStore } from "#engagement/application/ports/message-store.ts";
import { PrivateReplySender } from "#engagement/application/ports/private-reply-sender.ts";
import { PrivateReplyStore } from "#engagement/application/ports/private-reply-store.ts";
import { CommentIdSchema } from "#engagement/domain/comment-id.ts";
import { forgetComment, receiveComment } from "#engagement/domain/comment.ts";
import type { Comment } from "#engagement/domain/comment.ts";
import { followBox } from "#engagement/domain/message-box.ts";
import { PrivateReplyIdSchema } from "#engagement/domain/private-reply-id.ts";
import {
  settlePrivateReply,
  writePrivateReply,
} from "#engagement/domain/private-reply.ts";
import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import { ThreadIdSchema } from "#engagement/domain/thread-id.ts";
import { followPost } from "#engagement/domain/thread.ts";
import { DrizzleEngagementStore } from "#engagement/infrastructure/drizzle-engagement-store.ts";
import { DrizzleMessageStore } from "#engagement/infrastructure/drizzle-message-store.ts";
import { DrizzlePrivateReplyStore } from "#engagement/infrastructure/drizzle-private-reply-store.ts";
import { platformMessagesWith } from "#engagement/infrastructure/platforms/platform-messages.ts";
import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { CurrentInboxPlatforms } from "#shared/application/current-inbox-platforms.ts";
import { newId } from "#shared/application/ids.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { facebookMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import { facebookCommentScopes } from "#shared/domain/inbox-platform.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { channelAccessOf } from "#test/analytics/access-log.ts";
import {
  DatabaseTest,
  freshWorkspace,
  OpenOutboundGuard,
} from "#test/channels/support.ts";
import { fakeMetaMessages } from "#test/engagement/fakes/fake-meta-messages.ts";
import { reading } from "#test/engagement/support.ts";
import {
  facebookPageId,
  graphAppSecret,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import { textOf } from "#test/publishing/fakes/platform-server.ts";

// What the channel's gate runs for a private reply, between the real
// engagement tables and a loopback Graph: the last checks before Meta is
// asked, and what the adapter is handed. On Postgres, at instants no
// other suite uses (2051), on the live clock (Meta's calls of one account
// are half a second apart).

const StoreTest = Layer.mergeAll(
  DrizzlePrivateReplyStore,
  DrizzleEngagementStore,
  DrizzleMessageStore
).pipe(Layer.provideMerge(DatabaseTest));

const at = DateTime.makeUnsafe("2051-04-02T10:00:00.000Z");

const token = "synthetic-token-1";

const forget = (workspaceId: WorkspaceId) =>
  SqlClient.SqlClient.use((sql) =>
    Effect.all([
      sql`DELETE FROM engagement.threads WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.conversations WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_boxes WHERE workspace_id = ${workspaceId}`,
      sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`,
    ])
  ).pipe(Effect.orDie);

const pageAccount = (
  channelId: ChannelAccount["channelId"],
  scopes: readonly string[] = [
    facebookCommentScopes.read,
    ...facebookMessageScopes,
  ]
): ChannelAccount => ({
  accountId: facebookPageId,
  channelId,
  connection: Option.none(),
  platform: "facebook",
  scopes,
});

// A Page's comment 2001 by 7001, the Page's messages on, and a private
// reply to it journalled; the fake Graph knows the comment.
const journalledReply = Effect.fn("journalledReply")(function* journalledReply(
  workspaceId: WorkspaceId
) {
  const comments = yield* EngagementStore;
  const messages = yield* MessageStore;
  const store = yield* PrivateReplyStore;
  const sql = yield* SqlClient.SqlClient;
  const channelId = yield* newId(ChannelIdSchema);

  const thread = followPost(yield* newId(ThreadIdSchema), {
    authorId: Option.none(),
    channelId,
    permalink: Option.none(),
    platformPostId: PlatformPostIdSchema.make("1001"),
    postId: yield* newId(PostIdSchema),
    publishedAt: at,
    targetId: yield* newId(PostTargetIdSchema),
    workspaceId,
  });

  yield* comments.follow([thread]);

  const comment: Comment = receiveComment(
    yield* newId(CommentIdSchema),
    thread,
    reading(1, { writtenAt: at }),
    at
  );

  yield* comments.saveComments([comment]);
  yield* messages.switchOn(
    { channelId, enabledAt: at, enabledBy: Option.none(), workspaceId },
    followBox({ channelId, workspaceId }, at)
  );

  const reply = writePrivateReply(
    yield* newId(PrivateReplyIdSchema),
    comment,
    Option.none(),
    "Here is the link you asked for.",
    Option.none(),
    at
  );

  yield* sql.withTransaction(store.journal(reply, Option.none()));

  return { channelId, comment, reply };
});

// The gate's private replies for `account`, on a loopback Graph knowing
// the comment.
const gateFor = Effect.fnUntraced(function* gateFor(account: ChannelAccount) {
  const graph = yield* fakeMetaMessages([token], {
    me: facebookPageId,
    now: "2051-04-02T10:00:05+0000",
  });

  graph.comment("2001", "7001");

  const url = new URL(graph.url);

  const sender = yield* PrivateReplySender.pipe(
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
            Layer.succeed(
              CurrentInboxPlatforms,
              new Set(["facebook"] as const)
            ),
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

const requestOf = (reply: PrivateReply) => ({
  channelId: reply.channelId,
  privateReplyId: reply.id,
});

const posts = (graph: {
  readonly requests: () => readonly { method: string }[];
}) => graph.requests().filter(({ method }) => method === "POST").length;

layer(StoreTest, { excludeTestServices: true })(
  "the gate's private replies",
  (it) => {
    it.effect(
      "hand Meta the comment as kept, claim the call first, and find it again",
      () =>
        Effect.gen(function* sends() {
          const workspaceId = yield* freshWorkspace;

          yield* Effect.gen(function* checks() {
            const sql = yield* SqlClient.SqlClient;
            const { channelId, reply } = yield* journalledReply(workspaceId);
            const { graph, sender } = yield* gateFor(pageAccount(channelId));

            assert.deepStrictEqual(yield* sender.send(requestOf(reply)), {
              _tag: "sent",
              platformMessageId: "m_private_1",
            });

            const post = graph
              .requests()
              .find(({ method }) => method === "POST");

            assert.strictEqual(
              new URLSearchParams(post === undefined ? "" : textOf(post)).get(
                "recipient"
              ),
              JSON.stringify({ comment_id: "2001" })
            );

            const [claimed] = yield* sql<{
              readonly claimed: boolean;
            }>`SELECT call_claimed_at IS NOT NULL AS claimed FROM engagement.private_replies WHERE id = ${reply.id}`;

            assert.isTrue(claimed?.claimed);

            // Looked up by its commenter, and found.
            assert.deepStrictEqual(yield* sender.resume(requestOf(reply)), {
              _tag: "sent",
              platformMessageId: "m_private_1",
            });

            // A direct message sent from Peal under that id: taken, not this
            // one.
            const conversationId = yield* newId(ChannelIdSchema);

            yield* sql`INSERT INTO engagement.conversations (id, workspace_id, channel_id, platform_conversation_id, participants, revision, last_message_at, created_at)
            VALUES (${conversationId}, ${workspaceId}, ${channelId}, 'c-taken', '[]'::jsonb, 'r1', ${DateTime.formatIso(at)}::timestamptz, ${DateTime.formatIso(at)}::timestamptz)`;
            yield* sql`INSERT INTO engagement.outgoing_messages (id, conversation_id, workspace_id, channel_id, text, created_at, status, settled_at, platform_message_id)
            VALUES (${yield* newId(ChannelIdSchema)}, ${conversationId}, ${workspaceId}, ${channelId}, 'A synthetic answer', ${DateTime.formatIso(at)}::timestamptz, 'sent', ${DateTime.formatIso(at)}::timestamptz, 'm_private_1')`;

            assert.deepStrictEqual(yield* sender.resume(requestOf(reply)), {
              _tag: "unconfirmed",
              reason: "interrupted",
            });
          }).pipe(Effect.ensuring(forget(workspaceId)));
        })
    );

    it.effect("send nothing for one handed over before the gate's turn", () =>
      Effect.gen(function* handedOver() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const store = yield* PrivateReplyStore;
          const { channelId, reply } = yield* journalledReply(workspaceId);

          const handed = Result.getOrThrow(
            settlePrivateReply(
              reply,
              { _tag: "unconfirmed", reason: "interrupted" },
              at
            )
          );

          yield* store.advance(handed, reply);

          const { graph, sender } = yield* gateFor(pageAccount(channelId));

          assert.deepStrictEqual(yield* sender.send(requestOf(reply)), {
            _tag: "unconfirmed",
            reason: "interrupted",
          });
          assert.strictEqual(posts(graph), 0);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      })
    );

    it.effect(
      "ask nothing once the channel's messages are off, or its box another workspace's",
      () =>
        Effect.gen(function* off() {
          const workspaceId = yield* freshWorkspace;

          yield* Effect.gen(function* checks() {
            const sql = yield* SqlClient.SqlClient;
            const { channelId, reply } = yield* journalledReply(workspaceId);
            const { graph, sender } = yield* gateFor(pageAccount(channelId));

            yield* sql`UPDATE engagement.message_boxes SET workspace_id = ${WorkspaceIdSchema.make(
              "01900000-0000-7000-8000-0000000000b9"
            )} WHERE channel_id = ${channelId}`;

            assert.deepStrictEqual(yield* sender.send(requestOf(reply)), {
              _tag: "failed",
              reason: "channelUnavailable",
            });

            yield* sql`DELETE FROM engagement.message_boxes WHERE channel_id = ${channelId}`;

            assert.deepStrictEqual(yield* sender.send(requestOf(reply)), {
              _tag: "failed",
              reason: "channelUnavailable",
            });
            // A resume that cannot ask proves nothing.
            assert.deepStrictEqual(yield* sender.resume(requestOf(reply)), {
              _tag: "unconfirmed",
              reason: "interrupted",
            });
            assert.lengthOf(graph.requests(), 0);
          }).pipe(Effect.ensuring(forget(workspaceId)));
        })
    );

    it.effect(
      "ask nothing for a channel without the permissions, or a comment forgotten",
      () =>
        Effect.gen(function* unable() {
          const workspaceId = yield* freshWorkspace;

          yield* Effect.gen(function* checks() {
            const comments = yield* EngagementStore;

            const { channelId, comment, reply } =
              yield* journalledReply(workspaceId);

            const lacking = yield* gateFor(
              pageAccount(channelId, [facebookCommentScopes.read])
            );

            assert.deepStrictEqual(
              yield* lacking.sender.send(requestOf(reply)),
              { _tag: "failed", reason: "channelUnavailable" }
            );
            assert.lengthOf(lacking.graph.requests(), 0);

            yield* comments.saveComments([forgetComment(comment)]);

            const { graph, sender } = yield* gateFor(pageAccount(channelId));

            assert.deepStrictEqual(yield* sender.send(requestOf(reply)), {
              _tag: "failed",
              reason: "commentGone",
            });
            assert.lengthOf(graph.requests(), 0);
          }).pipe(Effect.ensuring(forget(workspaceId)));
        })
    );
  }
);
