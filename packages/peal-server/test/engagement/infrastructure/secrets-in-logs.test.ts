// What the server writes while it reads and answers Meta's direct
// messages never holds what a person wrote, who wrote it, the token or
// its proof: the adapter runs against the loopback Graph with a logger and
// a tracer that keep everything a line or a span would export, through a
// read, a refused answer, an answer sent, a lost one, a resume, each
// again as a person's answer with Meta's Human Agent tag, the
// account's events asked for and stopped, and a disconnected channel's;
// and a comment rule's private replies, run on Postgres, through a public
// reply, a private one, a refusal and a database that refuses one; and
// the warning on an erased workspace's channel that Meta did not let
// go, which names the channel's account and never its token or proof.
import { createHmac } from "node:crypto";

import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  DateTime,
  Duration,
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  Redacted,
  References,
  Tracer,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { SqlClient } from "effect/sql";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelDirectory } from "#channels/application/channel-directory.ts";
import { ChannelRecords } from "#channels/application/channel-records.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import { Channel } from "#channels/domain/channel.ts";
import { DrizzleChannelRecords } from "#channels/infrastructure/drizzle-channel-records.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import { metaMessageDepartures } from "#channels/infrastructure/platforms/meta/meta-message-departures.ts";
import { CommentRules } from "#engagement/application/comment-rules.ts";
import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import {
  accountPace,
  metaMessages,
} from "#engagement/infrastructure/platforms/meta/meta-messages.ts";
import { metaPrivateReplies } from "#engagement/infrastructure/platforms/meta/meta-private-replies.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { facebookMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { channelAccessOf } from "#test/analytics/access-log.ts";
import { metaApp } from "#test/channels/fakes/fake-meta.ts";
import {
  DatabaseTest,
  freshChannel,
  freshWorkspace,
  OpenOutboundGuard,
  TokenCipherTest,
} from "#test/channels/support.ts";
import {
  fakeMetaMessages,
  graphError,
} from "#test/engagement/fakes/fake-meta-messages.ts";
import {
  forget,
  instagramRule,
  privateText,
  publicRepliesEnd,
  received,
  RulesTest,
} from "#test/engagement/rule-world.ts";
import { outgoingMessageId, privateReplyId } from "#test/engagement/support.ts";
import {
  facebookPageId,
  graphAppSecret,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import { actorIn } from "#test/publishing/support.ts";

const token = "synthetic-page-token-secret";

const text = "synthetic private words 4821";

const answer = "synthetic private answer 9173";

const sender = { id: "7299999999999917", name: "Synthetic Writer Name" };

// Everything a span would export, as text.
const spanText = (span: Tracer.NativeSpan): string =>
  [
    span.name,
    JSON.stringify([...span.attributes]),
    JSON.stringify(span.events),
    span.status._tag === "Ended" && Exit.isFailure(span.status.exit)
      ? Cause.pretty(span.status.exit.cause)
      : "",
  ].join("\n");

// A logger and a tracer that keep everything a line or a span would
// export, and what they kept, as one text.
const capturing = () => {
  const lines: string[] = [];
  const spans: Tracer.NativeSpan[] = [];

  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);

      spans.push(span);

      return span;
    },
  });

  const capture = Logger.layer([
    Logger.make(({ cause, fiber, message }) => {
      lines.push(
        JSON.stringify(message),
        Cause.pretty(cause),
        JSON.stringify(fiber.getRef(References.CurrentLogAnnotations)),
        JSON.stringify(fiber.getRef(References.CurrentLogSpans))
      );
    }),
  ]);

  return {
    layer: Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer)),
    spans,
    text: () => [...lines, ...spans.map(spanText)].join("\n"),
  };
};

// Meta's departures against the loopback Graph at `url`, no other channel
// reading the accounts they carry.
const departuresAt = Effect.fnUntraced(function* departuresAt(url: URL) {
  const http = yield* publicHttpClient.pipe(
    Effect.provide(Layer.merge(FetchHttpClient.layer, OpenOutboundGuard))
  );

  return metaMessageDepartures({
    hosts: { ...metaHosts, facebookGraph: url, instagramGraph: url },
    http,
    mainApp: Option.some(metaApp),
    messages: new Set(["facebook"]),
  }).pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          ChannelDirectory,
          ChannelDirectory.of({
            after: () => Effect.succeed([]),
            withAccount: () => Effect.succeed([]),
          })
        ),
        Layer.succeed(
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
            readsMessages: () => Effect.succeed(false),
            refollow: () => Effect.void,
          })
        ),
        Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
      )
    )
  );
});

describe("what the server writes about Meta's private replies", () => {
  it.live(
    "holds no comment, text, commenter, token or proof, through a send, each refusal, a lost answer and a resume",
    () => {
      const kept = capturing();
      const comment = "synthetic comment words 5530";
      const commenter = { id: "7299999999999931", name: "Synthetic Commenter" };
      const reply = "synthetic private reply 6644";

      return Effect.gen(function* searched() {
        const graph = yield* fakeMetaMessages([token], { me: facebookPageId });
        const url = new URL(graph.url);

        graph.comment("c-1", commenter.id);
        graph.add({
          id: "c_1",
          messages: [
            {
              createdTime: "2026-11-16T09:00:00+0000",
              from: commenter,
              id: "m_1",
              text: comment,
            },
          ],
          participants: [
            { id: commenter.id, name: commenter.name },
            { id: facebookPageId, name: "Synthetic Page" },
          ],
          platform: "messenger",
          updatedTime: "2026-11-16T09:00:00+0000",
        });

        const account: ChannelAccount = {
          accountId: facebookPageId,
          channelId: ChannelIdSchema.make(
            "01900000-0000-7000-8000-0000000000e7"
          ),
          connection: Option.none(),
          platform: "facebook",
          scopes: ["pages_read_user_content", ...facebookMessageScopes],
        };

        const platform = yield* Effect.gen(function* building() {
          return yield* metaPrivateReplies({
            appSecret: Option.some(Redacted.make(graphAppSecret)),
            hosts: { ...metaHosts, facebookGraph: url, instagramGraph: url },
            http: yield* publicHttpClient,
            paced: yield* accountPace(Duration.zero),
          });
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              channelAccessOf(account, [token]),
              FetchHttpClient.layer,
              OpenOutboundGuard,
              Mac.layerWebCrypto.pipe(
                Layer.provide(SecureRandom.layerWebCrypto)
              )
            )
          )
        );

        const outgoing = {
          commentAuthorId: Option.some(commenter.id),
          createdAt: DateTime.makeUnsafe("2026-11-16T09:30:00.000Z"),
          platformCommentId: "c-1",
          privateReplyId: privateReplyId(1),
          takenIds: [],
          text: reply,
        };

        graph.script.push("POST /v27.0/me/messages", [
          graphError(10_903),
          graphError(10_904),
          graphError(2),
        ]);

        for (let n = 0; n < 3; n += 1) {
          yield* platform.send(account, outgoing);
        }

        graph.loseAnswer("POST /v27.0/me/messages");

        yield* platform.send(account, outgoing);
        yield* platform.resume(account, outgoing);
        yield* platform.send(account, outgoing);

        const proof = createHmac("sha256", graphAppSecret)
          .update(token)
          .digest("hex");

        const all = kept.text();

        // The calls were written about at all, and the refusals logged.
        assert.isAbove(kept.spans.length, 3);
        assert.include(all, "Meta refused a private reply");
        assert.include(all, "/me/conversations");

        for (const [name, secret] of [
          ["what the person commented", comment],
          ["what the account answered", reply],
          ["who commented", commenter.id],
          ["the commenter's name", commenter.name],
          ["the Page's token", token],
          ["the proof of the app's secret", proof],
        ] as const) {
          assert.notInclude(all, secret, name);
        }
      }).pipe(Effect.scoped, Effect.provide(kept.layer));
    }
  );
});

describe("what the server writes about Meta's direct messages", () => {
  it.live(
    "holds no text, sender, token or proof, through a read, a refusal, a send, a lost answer, a resume, a follow, an unfollow and a departure",
    () => {
      const lines: string[] = [];
      const spans: Tracer.NativeSpan[] = [];

      const tracer = Tracer.make({
        span: (options) => {
          const span = new Tracer.NativeSpan(options);

          spans.push(span);

          return span;
        },
      });

      const capture = Logger.layer([
        Logger.make(({ cause, fiber, message }) => {
          lines.push(
            JSON.stringify(message),
            Cause.pretty(cause),
            JSON.stringify(fiber.getRef(References.CurrentLogAnnotations)),
            JSON.stringify(fiber.getRef(References.CurrentLogSpans))
          );
        }),
      ]);

      return Effect.gen(function* searched() {
        const graph = yield* fakeMetaMessages([token], {
          humanAgent: true,
          me: facebookPageId,
        });

        const url = new URL(graph.url);

        graph.add({
          id: "c_1",
          messages: [
            {
              createdTime: "2026-11-16T09:00:00+0000",
              from: sender,
              id: "m_1",
              text,
            },
          ],
          participants: [
            { id: sender.id, name: sender.name },
            { id: facebookPageId, name: "Synthetic Page" },
          ],
          platform: "messenger",
          updatedTime: "2026-11-16T09:00:00+0000",
        });

        const account: ChannelAccount = {
          accountId: facebookPageId,
          channelId: ChannelIdSchema.make(
            "01900000-0000-7000-8000-0000000000e8"
          ),
          connection: Option.none(),
          platform: "facebook",
          scopes: [...facebookMessageScopes],
        };

        const platform = yield* Effect.gen(function* building() {
          return yield* metaMessages({
            appSecret: Option.some(Redacted.make(graphAppSecret)),
            hosts: { ...metaHosts, facebookGraph: url, instagramGraph: url },
            http: yield* publicHttpClient,
            pace: Duration.zero,
          });
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              channelAccessOf(account, [token]),
              FetchHttpClient.layer,
              OpenOutboundGuard,
              Mac.layerWebCrypto.pipe(
                Layer.provide(SecureRandom.layerWebCrypto)
              )
            )
          )
        );

        const outgoing = {
          createdAt: DateTime.makeUnsafe("2026-11-16T09:30:00.000Z"),
          latestPlatformId: Option.none<string>(),
          messageId: outgoingMessageId(1),
          participants: [
            {
              displayName: Option.some(sender.name),
              handle: "",
              platformId: sender.id,
            },
          ],
          platformConversationId: "c_1",
          humanAgent: false,
          request: false,
          takenIds: [],
          text: answer,
        };

        yield* platform.read(account, {
          keptSince: DateTime.makeUnsafe("2026-10-17T00:00:00.000Z"),
          known: new Map(),
        });

        graph.script.push("POST /v27.0/me/messages", [
          graphError(10, 2_018_278),
          graphError(200, 2_018_028),
        ]);

        yield* platform.send(account, outgoing);
        yield* platform.send(account, outgoing);
        yield* platform.send(account, outgoing);

        graph.loseAnswer("POST /v27.0/me/messages");

        yield* platform.send(account, outgoing);
        yield* platform.resume(account, outgoing);

        // A person's answer with Meta's Human Agent tag: refused past the
        // 7 days, refused to an app without the feature, sent, and lost.
        const tagged = { ...outgoing, humanAgent: true };

        graph.script.push("POST /v27.0/me/messages", [
          graphError(10, 2_018_278),
          graphError(200),
        ]);

        yield* platform.send(account, tagged);
        yield* platform.send(account, tagged);
        yield* platform.send(account, tagged);

        graph.loseAnswer("POST /v27.0/me/messages");

        yield* platform.send(account, tagged);
        yield* platform.resume(account, tagged);

        // The account's events, asked for and stopped.
        yield* Effect.exit(platform.follow?.(account) ?? Effect.void);
        yield* Effect.exit(
          platform.unfollow?.(account, {
            elsewhere: () => Effect.succeed(false),
            stopped: () => Effect.void,
          }) ?? Effect.void
        );

        // A disconnected channel's events, stopped with its tokens.
        yield* Effect.exit(platform.follow?.(account) ?? Effect.void);

        const at = DateTime.makeUnsafe("2026-11-16T10:00:00.000Z");

        const departing = new Channel({
          accountId: facebookPageId,
          avatarUrl: Option.none(),
          connection: Option.none(),
          createdAt: at,
          displayName: Option.none(),
          handle: "@synthetic_page",
          id: account.channelId,
          platform: "facebook",
          scopes: [...facebookMessageScopes],
          status: { _tag: "active" },
          token: { _tag: "nonExpiring" },
          updatedAt: at,
          workspaceId: WorkspaceIdSchema.make(
            "01900000-0000-7000-8000-0000000000a1"
          ),
        });

        const departures = yield* departuresAt(url);

        yield* ChannelDepartures.use((service) =>
          service.departed(departing, {
            accessToken: Redacted.make(token),
            refreshToken: Option.none(),
          })
        ).pipe(Effect.provide(departures));

        assert.isTrue(
          graph
            .requests()
            .some(
              ({ method, path }) =>
                method === "DELETE" && path === "/v27.0/me/subscribed_apps"
            )
        );

        const proof = createHmac("sha256", graphAppSecret)
          .update(token)
          .digest("hex");

        const all = [...lines, ...spans.map(spanText)].join("\n");

        // The calls were written about at all, and the refusals logged.
        assert.isAbove(spans.length, 3);
        assert.include(all, "Meta refused a direct message");

        for (const [name, secret] of [
          ["what the person wrote", text],
          ["what the account answered", answer],
          ["who wrote", sender.id],
          ["the writer's name", sender.name],
          ["the Page's token", token],
          ["the proof of the app's secret", proof],
        ] as const) {
          assert.notInclude(all, secret, name);
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
        )
      );
    }
  );
});

describe("what the server writes about a comment rule's private replies", () => {
  it.live(
    "holds no private text, comment or commenter, through a public reply, a private one, a refusal and a database that refuses the journal",
    () => {
      const kept = capturing();
      // A person whose ids and words appear nowhere else in a run.
      const commenter = 4_820_331;
      const comment = "synthetic price question 7712";

      return Effect.gen(function* searched() {
        const workspaceId = yield* freshWorkspace;
        const sql = yield* SqlClient.SqlClient;

        // The database refuses the private reply's journal once, as a
        // statement it should have taken: its error names the statement.
        const refusing = Effect.all([
          sql`CREATE OR REPLACE FUNCTION engagement.u13b_refuse_private() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'synthetic refusal'; END $$`,
          // A statement of the test's own, the workspace an id it made.
          sql.unsafe(`CREATE TRIGGER u13b_refuse_private BEFORE INSERT ON engagement.private_replies
            FOR EACH ROW WHEN (NEW.workspace_id = '${workspaceId}'::uuid)
            EXECUTE FUNCTION engagement.u13b_refuse_private()`),
        ]).pipe(Effect.orDie);

        const accepting = Effect.all([
          sql`DROP TRIGGER IF EXISTS u13b_refuse_private ON engagement.private_replies`,
          sql`DROP FUNCTION IF EXISTS engagement.u13b_refuse_private()`,
        ]).pipe(Effect.orDie);

        yield* Effect.gen(function* checks() {
          const { thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          const [asks, other] = yield* received(thread, [
            { author: commenter, text: comment },
            { author: commenter + 1, text: `${comment} again` },
          ]);

          assert.isDefined(asks);
          assert.isDefined(other);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");

          // Refused by the database: the run logs it and goes on.
          yield* refusing;
          yield* rules.runDue.pipe(Effect.ensuring(accepting));

          // A member answers one privately first: the rule's is refused.
          yield* EngagementPrivateReplies.use((replies) =>
            replies.send(
              actorIn(workspaceId),
              other.id,
              "synthetic member words"
            )
          );

          assert.strictEqual((yield* rules.runDue).privateReplied, 1);
        }).pipe(
          Effect.ensuring(accepting),
          Effect.ensuring(forget(workspaceId))
        );

        const all = kept.text();

        // The run was written about at all, and the refusal logged.
        assert.include(all, "CommentRules.followUp");
        assert.include(all, "A comment rule's run failed");

        for (const [name, secret] of [
          ["the rule's private text", privateText],
          ["what the person commented", comment],
          ["who commented", String(7000 + commenter)],
          ["the commenter's handle", `reader${String(commenter)}`],
          ["the commenter's name", `Reader ${String(commenter)}`],
        ] as const) {
          assert.notInclude(all, secret, name);
        }
      }).pipe(Effect.provide(Layer.merge(RulesTest, kept.layer)));
    }
  );
});

describe("what the server writes about an erased workspace's channels", () => {
  it.live(
    "names the account Meta did not let go, never its token or proof",
    () => {
      const kept = capturing();

      return Effect.gen(function* searched() {
        const graph = yield* fakeMetaMessages([token], { me: facebookPageId });
        const url = new URL(graph.url);

        // Meta refuses to stop the Page's events.
        graph.script.push("DELETE /v27.0/me/subscribed_apps", [
          graphError(2, undefined, 500),
        ]);

        const departures = yield* departuresAt(url);

        yield* Effect.gen(function* erased() {
          const workspaceId = yield* freshWorkspace;

          const channel = yield* freshChannel(workspaceId, {
            accountId: facebookPageId,
            platform: "facebook",
            scopes: facebookMessageScopes,
          });

          const credentials = yield* encryptTokens(
            {
              accessToken: Redacted.make(token),
              expiresAt: Option.none(),
              refreshToken: Option.none(),
              renewable: false,
              scopes: channel.scopes,
            },
            channel.id
          );

          yield* ChannelRepository.use((channels) =>
            channels.insert(channel, credentials)
          );

          yield* ChannelRecords.use((records) =>
            records.releaseWorkspaces([workspaceId])
          );

          // The release's own fiber logs once Meta has answered.
          for (
            let tries = 0;
            tries < 200 && !kept.text().includes("still sends");
            tries += 1
          ) {
            yield* Effect.sleep("10 millis");
          }

          const proof = createHmac("sha256", Redacted.value(metaApp.appSecret))
            .update(token)
            .digest("hex");

          const all = kept.text();

          assert.include(
            all,
            "A channel's platform still sends its events after an erasure"
          );
          assert.include(
            all,
            JSON.stringify({
              accountId: facebookPageId,
              channelId: channel.id,
              platform: "facebook",
            })
          );

          for (const [name, secret] of [
            ["the Page's token", token],
            ["the proof of the app's secret", proof],
          ] as const) {
            assert.notInclude(all, secret, name);
          }
        }).pipe(
          Effect.provide(
            DrizzleChannelRecords.pipe(
              Layer.provideMerge(
                Layer.mergeAll(
                  DrizzleChannelRepository,
                  TokenCipherTest,
                  departures
                )
              ),
              Layer.provideMerge(DatabaseTest)
            )
          )
        );
      }).pipe(Effect.scoped, Effect.provide(kept.layer));
    },
    120_000
  );
});
