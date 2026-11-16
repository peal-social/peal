import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option, Redacted } from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { accountPace } from "#engagement/infrastructure/platforms/meta/meta-messages.ts";
import { metaPrivateReplies } from "#engagement/infrastructure/platforms/meta/meta-private-replies.ts";
import type { OutgoingPrivateReply } from "#engagement/infrastructure/platforms/meta/meta-private-replies.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
  instagramPageMessageScopes,
} from "#shared/domain/inbox-message-platform.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { channelAccessOf } from "#test/analytics/access-log.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  fakeMetaMessages,
  graphError,
} from "#test/engagement/fakes/fake-meta-messages.ts";
import type { FakeMetaMessagesOptions } from "#test/engagement/fakes/fake-meta-messages.ts";
import { privateReplyId } from "#test/engagement/support.ts";
import {
  facebookPageId,
  graphAppSecret,
  instagramUserId,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import {
  json,
  rawJson,
  textOf,
} from "#test/publishing/fakes/platform-server.ts";

// Private replies to Facebook Pages' and Instagram's comments against a
// loopback Graph that answers as Meta's private replies pages say: one a
// comment, the comment as the recipient, no tag, no idempotency key.

const channelId = ChannelIdSchema.make("01900000-0000-7000-8000-0000000000ea");

const now = DateTime.makeUnsafe("2026-11-16T10:00:00.000Z");

// The commenter, by the id Meta gives a comment's author.
const commenter = "7200000000000009";

type Way = "instagramLogin" | "messenger" | "pageInstagram";

const ways: readonly Way[] = ["messenger", "pageInstagram", "instagramLogin"];

const accountOf = (way: Way): ChannelAccount =>
  way === "messenger"
    ? {
        accountId: facebookPageId,
        channelId,
        connection: Option.none(),
        platform: "facebook",
        scopes: ["pages_read_user_content", ...facebookMessageScopes],
      }
    : {
        accountId: instagramUserId,
        channelId,
        connection: Option.some(
          way === "instagramLogin" ? "instagramLogin" : "facebookLogin"
        ),
        platform: "instagram",
        scopes:
          way === "instagramLogin"
            ? ["instagram_business_manage_comments", instagramLoginMessageScope]
            : ["instagram_manage_comments", ...instagramPageMessageScopes],
      };

// The adapter on a fake Graph, as the account of `way`, with comment
// `c-1` by the commenter under its post.
const onGraph = Effect.fnUntraced(function* onGraph(
  way: Way = "messenger",
  options: FakeMetaMessagesOptions = {}
) {
  const graph = yield* fakeMetaMessages(["synthetic-token-1"], {
    ...options,
    instagramLogin: way === "instagramLogin",
    me: way === "messenger" ? facebookPageId : instagramUserId,
  });

  graph.comment("c-1", commenter);

  const url = new URL(graph.url);
  const account = accountOf(way);

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
        channelAccessOf(account, ["synthetic-token-1"]),
        FetchHttpClient.layer,
        OpenOutboundGuard,
        Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
      )
    )
  );

  return { account, graph, platform };
});

const outgoing = (
  changed: Partial<OutgoingPrivateReply> = {}
): OutgoingPrivateReply => ({
  commentAuthorId: Option.some(commenter),
  createdAt: now,
  platformCommentId: "c-1",
  privateReplyId: privateReplyId(1),
  takenIds: [],
  text: "Here is the link you asked for.",
  ...changed,
});

const atNow = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TestClock.setTime(DateTime.toEpochMillis(now)).pipe(Effect.andThen(effect));

const unconfirmed = (reason: "interrupted" | "noResponse") => ({
  _tag: "unconfirmed" as const,
  reason,
});

describe("Meta's private replies, sent", () => {
  it.effect("answer the comment through each way in, once, untagged", () =>
    atNow(
      Effect.gen(function* sent() {
        for (const way of ways) {
          const { account, graph, platform } = yield* onGraph(way);

          assert.deepStrictEqual(yield* platform.send(account, outgoing()), {
            _tag: "sent",
            platformMessageId: "m_private_1",
          });

          const request = graph
            .requests()
            .find(({ method }) => method === "POST");

          const body = new URLSearchParams(
            request === undefined ? "" : textOf(request)
          );

          assert.strictEqual(request?.path, "/v27.0/me/messages");
          assert.strictEqual(
            body.get("recipient"),
            JSON.stringify({ comment_id: "c-1" })
          );
          assert.isFalse(body.has("tag"));
          assert.isFalse(body.has("messaging_type"));
          assert.strictEqual(
            body.has("appsecret_proof"),
            way !== "instagramLogin"
          );

          // Meta takes one a comment: a second is refused, and said so.
          assert.deepStrictEqual(yield* platform.send(account, outgoing()), {
            _tag: "failed",
            reason: "alreadyAnswered",
          });
        }
      })
    )
  );

  it.effect(
    "say why Meta refused one, and leave unconfirmed what may have gone",
    () =>
      atNow(
        Effect.gen(function* refused() {
          const { account, graph, platform } = yield* onGraph();

          // Meta's own failures, and any answer Peal cannot read, may
          // follow a message that went out: never taken for not sent.
          const doubtful = [
            graphError(2, undefined, 500),
            graphError(1),
            graphError(2),
            graphError(100, undefined, 400, true),
            graphError(9999),
            rawJson("not json", 400),
            json({ unexpected: true }),
          ];

          graph.script.push("POST /v27.0/me/messages", doubtful);

          for (const _ of doubtful) {
            assert.deepStrictEqual(
              yield* platform.send(account, outgoing()),
              unconfirmed("noResponse")
            );
          }

          const cases = [
            [graphError(100, 2_534_025), "commentGone"],
            [graphError(10_900), "alreadyAnswered"],
            [graphError(10_903), "refused"],
            [graphError(10_904), "refused"],
            [graphError(551), "refused"],
            [graphError(10, 2_018_108), "refused"],
            [graphError(200, 2_018_028), "refused"],
            [graphError(10, 2_018_278), "windowClosed"],
            [graphError(10, 2_534_022), "windowClosed"],
            [graphError(613), "rateLimited"],
            [graphError(4), "rateLimited"],
            [graphError(190), "reconnectNeeded"],
          ] as const;

          graph.script.push(
            "POST /v27.0/me/messages",
            cases.map(([answer]) => answer)
          );

          for (const [, reason] of cases) {
            assert.deepStrictEqual(yield* platform.send(account, outgoing()), {
              _tag: "failed",
              reason,
            });
          }
        })
      )
  );

  it.effect(
    "leave unconfirmed one whose answer was lost, before or after Meta acted",
    () =>
      atNow(
        Effect.gen(function* lost() {
          const { account, graph, platform } = yield* onGraph();

          graph.loseAnswer("POST /v27.0/me/messages");

          assert.deepStrictEqual(
            yield* platform.send(account, outgoing()),
            unconfirmed("noResponse")
          );

          // It went: the resume finds it, and sends nothing.
          assert.deepStrictEqual(yield* platform.resume(account, outgoing()), {
            _tag: "sent",
            platformMessageId: "m_private_1",
          });

          const before = yield* onGraph("pageInstagram");

          before.graph.dropBefore("POST /v27.0/me/messages");

          assert.deepStrictEqual(
            yield* before.platform.send(before.account, outgoing()),
            unconfirmed("noResponse")
          );

          // It did not: the resume finds nothing, and still sends nothing.
          assert.deepStrictEqual(
            yield* before.platform.resume(before.account, outgoing()),
            unconfirmed("interrupted")
          );
          assert.isFalse(
            before.graph
              .requests()
              .slice(1)
              .some(({ method }) => method === "POST")
          );
        })
      )
  );
});

describe("Meta's private replies, resumed", () => {
  it.effect(
    "find exactly one of the account's, with the text, since it was written",
    () =>
      atNow(
        Effect.gen(function* found() {
          for (const way of ways) {
            const { account, graph, platform } = yield* onGraph(way);

            yield* platform.send(account, outgoing());

            assert.deepStrictEqual(
              yield* platform.resume(account, outgoing()),
              {
                _tag: "sent",
                platformMessageId: "m_private_1",
              }
            );

            const listed = graph
              .requests()
              .find(({ path }) => path === "/v27.0/me/conversations");

            assert.strictEqual(listed?.query.get("user_id"), commenter);
            assert.strictEqual(
              listed?.query.get("platform"),
              way === "messenger" ? "messenger" : "instagram"
            );
          }
        })
      )
  );

  it.effect(
    "leave unconfirmed none, two, a taken id, no conversation, or no author",
    () =>
      atNow(
        Effect.gen(function* doubtful() {
          // Nothing in the Conversations API before the person answers.
          const unlisted = yield* onGraph("messenger", {
            privateRepliesListed: false,
          });

          yield* unlisted.platform.send(unlisted.account, outgoing());

          assert.deepStrictEqual(
            yield* unlisted.platform.resume(unlisted.account, outgoing()),
            unconfirmed("interrupted")
          );

          const { account, graph, platform } = yield* onGraph();

          yield* platform.send(account, outgoing());

          // Taken by another message of Peal's.
          assert.deepStrictEqual(
            yield* platform.resume(
              account,
              outgoing({ takenIds: ["m_private_1"] })
            ),
            unconfirmed("interrupted")
          );

          // Another text, or written before the reply was (less a minute).
          assert.deepStrictEqual(
            yield* platform.resume(account, outgoing({ text: "Another." })),
            unconfirmed("interrupted")
          );
          assert.deepStrictEqual(
            yield* platform.resume(
              account,
              outgoing({ createdAt: DateTime.addDuration(now, "1 hour") })
            ),
            unconfirmed("interrupted")
          );

          // The commenter forgotten: nobody to look for.
          assert.deepStrictEqual(
            yield* platform.resume(
              account,
              outgoing({ commentAuthorId: Option.none() })
            ),
            unconfirmed("interrupted")
          );

          // Two of the account's with the text: which is it?
          const [talk] = graph.conversations();

          talk?.messages.push({
            createdTime: "2026-11-16T10:00:06+0000",
            from: { id: facebookPageId, name: "Synthetic Studio" },
            id: "m_twin",
            text: "Here is the link you asked for.",
          });

          assert.deepStrictEqual(
            yield* platform.resume(account, outgoing()),
            unconfirmed("interrupted")
          );

          // A read Meta refuses.
          graph.script.push("GET /v27.0/me/conversations", [graphError(2)]);

          assert.deepStrictEqual(
            yield* platform.resume(account, outgoing()),
            unconfirmed("interrupted")
          );

          assert.isFalse(
            graph
              .requests()
              .slice(1)
              .some(({ method }) => method === "POST")
          );
        })
      )
  );
});
