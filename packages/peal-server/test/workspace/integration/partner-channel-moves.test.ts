import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { SqlClient } from "effect/sql";
// Moving a channel between two of a partner's customers, through the
// partner API, on Postgres: who may, between which workspaces, what goes
// with the channel and what stays, a post in flight, and the erasure of
// the workspace it went to.
import { forWorkspace } from "peal-contract";

import { encryptTokens } from "#channels/application/channel-tokens.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { syntheticKeyring, TokenCipherTest } from "#test/channels/support.ts";

import {
  bodyOf,
  MigratedSqlLive,
  TestApp,
  unconfirmedEmails,
} from "./harness.ts";
import {
  bearer,
  customerOf,
  everyPermission,
  everyScope,
  keyOf,
  partnerOf,
} from "./partner-support.ts";
import { newUuid7, seedChannel, seedPost } from "./seed.ts";

const MovesLive = Layer.mergeAll(
  TestApp.layerWith({
    ...unconfirmedEmails,
    PEAL_PARTNER_SELF_SERVICE: "true",
    PEAL_TOKEN_KEYS: syntheticKeyring,
  }),
  MigratedSqlLive
);

const ChannelSchema = Schema.Struct({
  handle: Schema.String,
  id: Schema.String,
  label: Schema.NullOr(Schema.String),
  platform: Schema.String,
});

const ChannelsSchema = Schema.Array(ChannelSchema);

const MovedSchema = Schema.Struct({
  channel: ChannelSchema,
  postsLeft: Schema.Number,
});

const ActivitySchema = Schema.Struct({
  items: Schema.Array(Schema.Struct({ operation: Schema.String })),
});

const IdsSchema = Schema.Array(Schema.Struct({ id: Schema.String }));

const CountSchema = Schema.Array(Schema.Struct({ rows: Schema.Number }));

// A channel of the workspace whose tokens the server's keyring opens.
const connectedIn = Effect.fn("connectedIn")(function* connectedIn(
  workspaceId: string,
  handle: string
) {
  const sql = yield* SqlClient.SqlClient;
  const id = yield* seedChannel(workspaceId, handle);

  const credentials = yield* encryptTokens(
    {
      accessToken: Redacted.make("synthetic-access-token"),
      expiresAt: Option.none(),
      refreshToken: Option.none(),
      renewable: false,
      scopes: [],
    },
    ChannelIdSchema.make(id)
  ).pipe(Effect.provide(TokenCipherTest), Effect.orDie);

  yield* sql`UPDATE channels.channels SET access_token = ${credentials.accessToken}, token_key_id = 'test-key', label = 'Kept behind' WHERE id = ${id}`;

  return id;
});

const channelsOf = Effect.fn("channelsOf")(function* channelsOf(
  key: string,
  workspaceId: string
) {
  const app = yield* TestApp;

  const reply = yield* app.request(`/api/v1/channels`, {
    headers: { ...bearer(key), ...forWorkspace(workspaceId) },
  });

  return yield* bodyOf(ChannelsSchema, reply);
});

layer(MovesLive, { excludeTestServices: true, timeout: "180 seconds" })(
  "moving a channel between a partner's customers",
  (it) => {
    it.effect(
      "makes it the other workspace's, under a new id, and leaves the posts behind",
      () =>
        Effect.gen(function* moves() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const { home, owner } = yield* partnerOf("moves");

          const { key } = yield* keyOf(owner, home, {
            permissions: [...everyPermission, "activity:read"],
          });

          const from = yield* customerOf(key, "From customer");
          const to = yield* customerOf(key, "To customer");

          const channelId = yield* connectedIn(
            from.id,
            "@moved@social.example"
          );

          const postId = yield* seedPost(from.id, channelId, "Stays behind");

          // Scheduled on the channel: it fails there, and the move says so.
          yield* sql`UPDATE publishing.posts SET status = 'scheduled', scheduled_at = now() + interval '1 day' WHERE id = ${postId}`;
          // A draft does not go out: it is not counted.
          yield* seedPost(from.id, channelId, "A draft");

          const reply = yield* app.request(
            `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
            { body: { toWorkspaceId: to.id }, headers: bearer(key) }
          );

          assert.strictEqual(reply.status, 200);

          const { channel: moved, postsLeft } = yield* bodyOf(
            MovedSchema,
            reply
          );

          assert.strictEqual(postsLeft, 1);
          assert.notStrictEqual(moved.id, channelId);
          assert.deepStrictEqual(
            { ...moved, id: "" },
            {
              handle: "@moved@social.example",
              id: "",
              label: null,
              platform: "mastodon",
            }
          );
          assert.deepStrictEqual(yield* channelsOf(key, from.id), []);
          assert.deepStrictEqual(
            (yield* channelsOf(key, to.id)).map(({ id }) => id),
            [moved.id]
          );

          // The post is the workspace's it was made in, its target on the
          // channel it named, which fails there as a disconnected one's.
          const [post] =
            yield* sql`SELECT count(*)::int AS rows FROM publishing.post_targets t JOIN publishing.posts p ON p.id = t.post_id WHERE p.id = ${postId} AND p.workspace_id = ${from.id} AND t.channel_id = ${channelId}`.pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CountSchema))
            );

          assert.deepStrictEqual(post, { rows: 1 });

          // Each workspace's log says the channel left, or came.
          for (const workspaceId of [from.id, to.id]) {
            const log = yield* app.request(`/api/v1/workspace/activity`, {
              headers: { ...bearer(key), ...forWorkspace(workspaceId) },
            });

            assert.include(
              (yield* bodyOf(ActivitySchema, log)).items.map(
                ({ operation }) => operation
              ),
              "partner.moveChannel"
            );
          }

          // It moves back, under a new id again, and the workspace it went
          // to keeps nothing of it.
          const back = yield* app.request(
            `/api/v1/partner/workspaces/${to.id}/channels/${moved.id}/move`,
            { body: { toWorkspaceId: from.id }, headers: bearer(key) }
          );

          assert.strictEqual(back.status, 200);
          assert.lengthOf(yield* channelsOf(key, to.id), 0);
          assert.lengthOf(yield* channelsOf(key, from.id), 1);
        })
    );

    it.effect("answers a move sent again with its key as the first did", () =>
      Effect.gen(function* again() {
        const app = yield* TestApp;
        const { home, owner } = yield* partnerOf("again");
        const { key } = yield* keyOf(owner, home);
        const from = yield* customerOf(key, "Again from");
        const to = yield* customerOf(key, "Again to");
        const other = yield* customerOf(key, "Again elsewhere");
        const channelId = yield* connectedIn(from.id, "@again@social.example");
        const path = `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`;

        const send = (toWorkspaceId: string) =>
          app.request(path, {
            body: { toWorkspaceId },
            headers: { ...bearer(key), "idempotency-key": "move-synthetic-1" },
          });

        const first = yield* send(to.id);

        assert.strictEqual(first.status, 200);

        const moved = yield* bodyOf(MovedSchema, first);

        // Its answer lost, the same request answers the channel where it
        // went, and moves nothing more.
        const retried = yield* send(to.id);

        assert.strictEqual(retried.status, 200);
        assert.deepStrictEqual(yield* bodyOf(MovedSchema, retried), moved);
        assert.lengthOf(yield* channelsOf(key, to.id), 1);

        // The same key for another move is refused.
        const reused = yield* send(other.id);

        assert.strictEqual(reused.status, 409);
        assert.deepInclude(reused.body, { _tag: "IdempotencyKeyReused" });
        assert.lengthOf(yield* channelsOf(key, other.id), 0);
      })
    );

    it.effect(
      "refuses what the key may not do, and workspaces not its partner's",
      () =>
        Effect.gen(function* refuses() {
          const app = yield* TestApp;
          const { home, owner } = yield* partnerOf("refuses");
          const { key } = yield* keyOf(owner, home);
          const from = yield* customerOf(key, "Refusing from");
          const to = yield* customerOf(key, "Refusing to");
          const channelId = yield* connectedIn(from.id, "@kept@social.example");
          const other = yield* partnerOf("another");
          const { key: otherKey } = yield* keyOf(other.owner, other.home);
          const stranger = yield* customerOf(otherKey, "Another's customer");

          const move = (
            using: string,
            path: { readonly channel: string; readonly from: string },
            toWorkspaceId: string
          ) =>
            app.request(
              `/api/v1/partner/workspaces/${path.from}/channels/${path.channel}/move`,
              { body: { toWorkspaceId }, headers: bearer(using) }
            );

          const { key: readOnly } = yield* keyOf(owner, home, {
            scopes: ["workspaces:read"],
          });

          const { key: connectOnly } = yield* keyOf(owner, home, {
            permissions: everyPermission.filter(
              (permission) => permission !== "channel:disconnect"
            ),
            scopes: everyScope,
          });

          const statuses = yield* Effect.all([
            move(readOnly, { channel: channelId, from: from.id }, to.id),
            move(connectOnly, { channel: channelId, from: from.id }, to.id),
            // The home workspace is no customer, another partner's none of
            // its own.
            move(key, { channel: channelId, from: from.id }, home),
            move(key, { channel: channelId, from: from.id }, stranger.id),
            move(otherKey, { channel: channelId, from: from.id }, stranger.id),
            move(key, { channel: randomUUID(), from: from.id }, to.id),
            move(key, { channel: "not-a-channel", from: from.id }, to.id),
            move(key, { channel: channelId, from: from.id }, from.id),
          ]).pipe(Effect.map((replies) => replies.map(({ status }) => status)));

          assert.deepStrictEqual(
            statuses,
            [403, 403, 404, 404, 404, 404, 404, 409]
          );
          assert.lengthOf(yield* channelsOf(key, from.id), 1);
        })
    );

    it.effect(
      "refuses a workspace that has the account, and waits for a post going out",
      () =>
        Effect.gen(function* busy() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const { home, owner } = yield* partnerOf("busy");
          const { key } = yield* keyOf(owner, home);
          const from = yield* customerOf(key, "Busy from");
          const to = yield* customerOf(key, "Busy to");
          const channelId = yield* connectedIn(from.id, "@busy@social.example");

          // The same account connected in the other workspace already.
          const there = yield* connectedIn(to.id, "@busy@social.example");

          yield* sql`UPDATE channels.channels SET account_id = (SELECT account_id FROM channels.channels WHERE id = ${channelId}) WHERE id = ${there}`;

          const taken = yield* app.request(
            `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
            { body: { toWorkspaceId: to.id }, headers: bearer(key) }
          );

          assert.strictEqual(taken.status, 409);
          assert.deepInclude(taken.body, {
            _tag: "ChannelAccountTaken",
            channelId: there,
          });

          yield* sql`DELETE FROM channels.channels WHERE id = ${there}`;

          // A call through the channel, begun and not ended.
          const postId = yield* seedPost(
            from.id,
            channelId,
            "Going out",
            "publishing"
          );

          const [target] =
            yield* sql`SELECT id FROM publishing.post_targets WHERE post_id = ${postId}`.pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(IdsSchema))
            );

          const callKey = randomUUID();

          yield* sql`INSERT INTO publishing.publication_calls (idempotency_key, target_id, round, attempt, operation, started_at)
            VALUES (${callKey}, ${target?.id ?? ""}, 1, 1, 'publish', now())`;

          const going = yield* app.request(
            `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
            { body: { toWorkspaceId: to.id }, headers: bearer(key) }
          );

          assert.strictEqual(going.status, 409);
          assert.deepInclude(going.body, {
            _tag: "WorkspaceBusy",
            workspaceId: from.id,
          });
          assert.lengthOf(yield* channelsOf(key, from.id), 1);

          // Once it ended, the channel moves.
          yield* sql`UPDATE publishing.publication_calls SET finished_at = now(), outcome = '{"_tag":"published"}'::jsonb WHERE idempotency_key = ${callKey}`;
          yield* sql`UPDATE publishing.posts SET status = 'finished' WHERE id = ${postId}`;

          const moved = yield* app.request(
            `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
            { body: { toWorkspaceId: to.id }, headers: bearer(key) }
          );

          assert.strictEqual(moved.status, 200);
        })
    );

    it.effect(
      "waits for a follow-up and a reply on their way through the channel",
      () =>
        Effect.gen(function* sending() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const { home, owner } = yield* partnerOf("sending");
          const { key } = yield* keyOf(owner, home);
          const from = yield* customerOf(key, "Sending from");
          const to = yield* customerOf(key, "Sending to");

          const channelId = yield* connectedIn(
            from.id,
            "@sending@social.example"
          );

          const postId = yield* seedPost(
            from.id,
            channelId,
            "Live",
            "finished"
          );

          const [target] =
            yield* sql`SELECT id FROM publishing.post_targets WHERE post_id = ${postId}`.pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(IdsSchema))
            );

          const ruleId = newUuid7();
          const followUpId = newUuid7();

          yield* sql`INSERT INTO publishing.follow_up_rules (id, workspace_id, scope, post_id, likes, comment, repost, approval, status, started_via, created_at)
            VALUES (${ruleId}, ${from.id}, 'post', ${postId}, 50, 'A synthetic follow-up', false, '{"_tag":"notNeeded"}'::jsonb, 'active', '{"_tag":"web"}'::jsonb, now())`;
          yield* sql`INSERT INTO publishing.follow_ups (id, rule_id, workspace_id, post_id, target_id, channel_id, kind, status, state, armed_at, triggered_at, call_claimed_at)
            VALUES (${followUpId}, ${ruleId}, ${from.id}, ${postId}, ${target?.id ?? ""}, ${channelId}, 'comment', 'sending', '{"_tag":"sending","likes":50,"attemptedAt":null}'::jsonb, now(), now(), now())`;

          const move = app.request(
            `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
            { body: { toWorkspaceId: to.id }, headers: bearer(key) }
          );

          const following = yield* move;

          assert.strictEqual(following.status, 409);
          assert.deepInclude(following.body, { _tag: "WorkspaceBusy" });

          yield* sql`DELETE FROM publishing.follow_ups WHERE id = ${followUpId}`;

          // A reply under the post, its call claimed and not ended.
          const threadId = newUuid7();
          const commentId = newUuid7();

          yield* sql`INSERT INTO engagement.threads (id, workspace_id, channel_id, target_id, post_id, platform_post_id, published_at, next_collection_at, comment_count, unanswered_count, last_comment_at)
            VALUES (${threadId}, ${from.id}, ${channelId}, ${target?.id ?? ""}, ${postId}, 'synthetic-post', now(), now(), 1, 1, now())`;
          yield* sql`INSERT INTO engagement.comments (id, thread_id, workspace_id, channel_id, platform_comment_id, author_platform_id, author_handle, author_display_name, text, written_at, received_at, state)
            VALUES (${commentId}, ${threadId}, ${from.id}, ${channelId}, 'synthetic-comment', '7001', 'reader@social.example', 'A synthetic reader', 'A synthetic comment', now(), now(), 'answered')`;
          yield* sql`INSERT INTO engagement.replies (id, thread_id, comment_id, workspace_id, channel_id, text, created_at, status, call_claimed_at)
            VALUES (${newUuid7()}, ${threadId}, ${commentId}, ${from.id}, ${channelId}, 'A synthetic reply', now(), 'sending', now())`;

          const replying = yield* move;

          assert.strictEqual(replying.status, 409);
          assert.deepInclude(replying.body, { _tag: "WorkspaceBusy" });
          assert.lengthOf(yield* channelsOf(key, from.id), 1);

          // Nothing left on its way for the jobs, or the tests, that read
          // every reply still sending.
          yield* sql`DELETE FROM engagement.threads WHERE id = ${threadId}`;
        })
    );

    it.effect(
      "answers 409 rather than wait long for a workspace another request holds",
      () =>
        Effect.gen(function* held() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const { home, owner } = yield* partnerOf("held");
          const { key } = yield* keyOf(owner, home);
          const from = yield* customerOf(key, "Held from");
          const to = yield* customerOf(key, "Held to");
          const channelId = yield* connectedIn(from.id, "@held@social.example");

          // The workspace it goes to, held as an erasure holds it.
          const moved = yield* Effect.scoped(
            Effect.gen(function* holding() {
              const connection = yield* sql.reserve;

              yield* connection.executeRaw("BEGIN", []);
              yield* connection.execute(
                "SELECT id FROM auth.organization WHERE id = $1 FOR UPDATE",
                [to.id],
                undefined
              );

              const reply = yield* app.request(
                `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
                { body: { toWorkspaceId: to.id }, headers: bearer(key) }
              );

              yield* connection.executeRaw("ROLLBACK", []);

              return reply;
            })
          );

          assert.strictEqual(moved.status, 409);
          assert.deepInclude(moved.body, { _tag: "WorkspaceBusy" });
          assert.lengthOf(yield* channelsOf(key, from.id), 1);
        })
    );

    it.effect(
      "goes with the workspace it went to when that one is offboarded",
      () =>
        Effect.gen(function* offboarded() {
          const app = yield* TestApp;
          const sql = yield* SqlClient.SqlClient;
          const { home, owner } = yield* partnerOf("offboard");
          const { key } = yield* keyOf(owner, home);
          const from = yield* customerOf(key, "Offboard from");
          const to = yield* customerOf(key, "Offboard to");
          const channelId = yield* connectedIn(from.id, "@gone@social.example");

          const reply = yield* app.request(
            `/api/v1/partner/workspaces/${from.id}/channels/${channelId}/move`,
            { body: { toWorkspaceId: to.id }, headers: bearer(key) }
          );

          const { channel: moved } = yield* bodyOf(MovedSchema, reply);

          const deleted = yield* app.request(
            `/api/v1/partner/workspaces/${to.id}`,
            {
              headers: bearer(key),
              method: "DELETE",
            }
          );

          assert.strictEqual(deleted.status, 204);

          const left =
            yield* sql`SELECT id FROM channels.channels WHERE id IN (${channelId}, ${moved.id})`.pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(IdsSchema))
            );

          assert.deepStrictEqual(left, []);
        })
    );
  }
);
