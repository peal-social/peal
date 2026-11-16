import { setTimeout as delay } from "node:timers/promises";

import { assert, describe, it } from "@effect/vitest";
import {
  DateTime,
  Duration,
  Effect,
  Fiber,
  Layer,
  Option,
  Redacted,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import type { MessageSendOutcome } from "#engagement/domain/outgoing-message.ts";
import type {
  FollowedElsewhere,
  MessagePlatform,
  OutgoingDirect,
} from "#engagement/infrastructure/platforms/message-platform.ts";
import { metaMessages } from "#engagement/infrastructure/platforms/meta/meta-messages.ts";
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
import type {
  FakeDirect,
  FakeMetaMessagesOptions,
} from "#test/engagement/fakes/fake-meta-messages.ts";
import { outgoingMessageId } from "#test/engagement/support.ts";
import {
  businessUsage,
  facebookPageId,
  graphAppSecret,
  instagramUserId,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import { json, rawJson } from "#test/publishing/fakes/platform-server.ts";

// Messenger's and Instagram's direct messages against a loopback Graph
// that answers as Meta's Conversations API and Send API pages say: only
// the 20 latest messages of a conversation come with their details, and
// nothing takes an idempotency key.

const channelId = ChannelIdSchema.make("01900000-0000-7000-8000-0000000000e9");

const now = DateTime.makeUnsafe("2026-11-16T10:00:00.000Z");

const keptSince = DateTime.subtractDuration(now, "30 days");

const reader = { id: "7200000000000001", name: "Synthetic Reader" };

const igReader = { id: "ig7300000000000001", name: "synthetic.reader" };

type Way = "instagramLogin" | "messenger" | "pageInstagram";

const accountOf = (way: Way): ChannelAccount => {
  if (way === "messenger") {
    return {
      accountId: facebookPageId,
      channelId,
      connection: Option.none(),
      platform: "facebook",
      scopes: ["pages_show_list", ...facebookMessageScopes],
    };
  }

  return {
    accountId: instagramUserId,
    channelId,
    connection: Option.some(
      way === "instagramLogin" ? "instagramLogin" : "facebookLogin"
    ),
    platform: "instagram",
    scopes:
      way === "instagramLogin"
        ? ["instagram_business_basic", instagramLoginMessageScope]
        : ["instagram_basic", ...instagramPageMessageScopes],
  };
};

// The adapter on a fake Graph, as the account of `way`.
const onGraph = Effect.fnUntraced(function* onGraph(
  way: Way = "messenger",
  options: FakeMetaMessagesOptions & { readonly pace?: Duration.Duration } = {}
) {
  const instagramLogin = way === "instagramLogin";

  const graph = yield* fakeMetaMessages(["synthetic-token-1"], {
    ...options,
    instagramLogin,
    me: options.me ?? (way === "messenger" ? facebookPageId : instagramUserId),
  });

  const url = new URL(graph.url);
  const account = accountOf(way);

  const platform = yield* Effect.gen(function* building() {
    return yield* metaMessages({
      appSecret: Option.some(Redacted.make(graphAppSecret)),
      hosts: { ...metaHosts, facebookGraph: url, instagramGraph: url },
      http: yield* publicHttpClient,
      pace: options.pace ?? Duration.zero,
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

const message = (n: number, changed: Partial<FakeDirect> = {}): FakeDirect => ({
  createdTime: `2026-11-16T09:${String(n % 60).padStart(2, "0")}:00+0000`,
  from: reader,
  id: `m_${String(n)}`,
  text: `Message ${String(n)}`,
  ...changed,
});

const conversation = (
  id: string,
  messages: readonly FakeDirect[],
  changed: { readonly platform?: "instagram" | "messenger" } = {}
) => ({
  id,
  messages,
  participants:
    changed.platform === "instagram"
      ? [
          { id: igReader.id, username: igReader.name },
          { id: instagramUserId, username: "synthetic_studio" },
        ]
      : [
          { id: reader.id, name: reader.name },
          { id: facebookPageId, name: "Synthetic Page" },
        ],
  platform: changed.platform ?? "messenger",
  updatedTime: messages.at(-1)?.createdTime ?? "2026-11-16T09:00:00+0000",
});

const toRead = { keptSince, known: new Map<string, string>() };

const outgoing = (changed: Partial<OutgoingDirect> = {}): OutgoingDirect => ({
  createdAt: now,
  latestPlatformId: Option.none(),
  messageId: outgoingMessageId(1),
  participants: [
    {
      displayName: Option.some(reader.name),
      handle: "",
      platformId: reader.id,
    },
  ],
  platformConversationId: "c_1",
  request: false,
  takenIds: [],
  text: "Thank you, synthetic reader!",
  ...changed,
});

// The platform's subscription calls, which Meta's adapter has.
const following = (platform: MessagePlatform) => {
  const { follow, unfollow } = platform;

  if (follow === undefined || unfollow === undefined) {
    throw new Error("Meta's adapter follows accounts");
  }

  return {
    follow,
    unfollow: (account: ChannelAccount, elsewhere: FollowedElsewhere) =>
      unfollow(account, elsewhere),
  };
};

const atNow = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  TestClock.setTime(DateTime.toEpochMillis(now)).pipe(Effect.andThen(effect));

describe("Meta's direct messages, read", () => {
  it.effect(
    "list a Page's conversations across pages and read back each one",
    () =>
      atNow(
        Effect.gen(function* across() {
          const { account, graph, platform } = yield* onGraph();

          for (let n = 1; n <= 60; n += 1) {
            graph.add(conversation(`c_${String(n)}`, [message(n)]));
          }

          const reading = platform.read(account, toRead);
          const fiber = yield* Effect.forkChild(reading);

          const batch = yield* Fiber.join(fiber);

          assert.isFalse(batch.halted);
          assert.isTrue(batch.listedWhole);
          assert.lengthOf(batch.listed, 60);
          assert.lengthOf(batch.conversations, 60);

          const [first] = batch.conversations;

          assert.deepStrictEqual(first?.participants, [
            {
              displayName: Option.some(reader.name),
              handle: "",
              platformId: reader.id,
            },
          ]);
          assert.isTrue(first?.complete);
          assert.strictEqual(first?.messages[0]?.text, "Message 1");
          assert.isFalse(first?.messages[0]?.fromAccount);
        })
      )
  );

  it.effect(
    "take a conversation of 25 messages for not whole, and one of 3 for whole",
    () =>
      atNow(
        Effect.gen(function* twenty() {
          const { account, graph, platform } = yield* onGraph();

          graph.add(
            conversation(
              "c_long",
              Array.from({ length: 25 }, (_, n) => message(n + 1))
            )
          );
          graph.add(
            conversation("c_short", [message(1), message(2), message(3)])
          );

          const fiber = yield* Effect.forkChild(platform.read(account, toRead));

          const batch = yield* Fiber.join(fiber);

          const long = batch.conversations.find(
            ({ platformConversationId }) => platformConversationId === "c_long"
          );

          const short = batch.conversations.find(
            ({ platformConversationId }) => platformConversationId === "c_short"
          );

          assert.isFalse(long?.complete);
          assert.lengthOf(long?.messages ?? [], 20);
          assert.isTrue(short?.complete);
          assert.lengthOf(short?.messages ?? [], 3);
          assert.deepStrictEqual(short?.deleted, []);
        })
      )
  );

  it.effect(
    "count a story mention and the files of a message, keeping no address",
    () =>
      atNow(
        Effect.gen(function* files() {
          const { account, graph, platform } = yield* onGraph("pageInstagram");

          graph.add(
            conversation(
              "c_story",
              [
                message(1, { from: igReader, story: "s1", text: "" }),
                message(2, { attachments: ["a1", "a2"], from: igReader }),
              ],
              { platform: "instagram" }
            )
          );

          const fiber = yield* Effect.forkChild(platform.read(account, toRead));

          const batch = yield* Fiber.join(fiber);
          const [read] = batch.conversations;

          assert.deepStrictEqual(
            read?.messages.map(({ attachments }) => attachments),
            [1, 2]
          );
          assert.deepStrictEqual(read?.participants, [
            {
              displayName: Option.none(),
              handle: "@synthetic.reader",
              platformId: igReader.id,
            },
          ]);
          assert.notInclude(JSON.stringify(batch), "cdn.example");
        })
      )
  );

  it.effect(
    "keep a text as Meta gives it, and a participant without a name",
    () =>
      atNow(
        Effect.gen(function* odd() {
          const { account, graph, platform } = yield* onGraph();

          graph.add({
            id: "c_odd",
            messages: [message(1, { text: "a\u0000b\uD800c" })],
            participants: [{ id: reader.id }, { id: facebookPageId }],
            platform: "messenger",
            updatedTime: "2026-11-16T09:01:00+0000",
          });

          const fiber = yield* Effect.forkChild(platform.read(account, toRead));

          const [read] = (yield* Fiber.join(fiber)).conversations;

          assert.strictEqual(read?.messages[0]?.text, "a\u0000b\uD800c");
          assert.deepStrictEqual(read?.participants, [
            { displayName: Option.none(), handle: "", platformId: reader.id },
          ]);
        })
      )
  );

  it.effect("read back only a conversation whose revision changed", () =>
    atNow(
      Effect.gen(function* known() {
        const { account, graph, platform } = yield* onGraph();

        graph.add(conversation("c_1", [message(1)]));
        graph.add(conversation("c_2", [message(2)]));

        const fiber = yield* Effect.forkChild(
          platform.read(account, {
            keptSince,
            known: new Map([["c_1", "2026-11-16T09:01:00+0000"]]),
          })
        );

        const batch = yield* Fiber.join(fiber);

        assert.deepStrictEqual(
          batch.conversations.map(
            ({ platformConversationId }) => platformConversationId
          ),
          ["c_2"]
        );
        assert.deepStrictEqual(batch.listed, ["c_1", "c_2"]);
      })
    )
  );

  it.effect("wait half a second between two calls of one account", () =>
    atNow(
      Effect.gen(function* pace() {
        const { account, graph, platform } = yield* onGraph("messenger", {
          pace: Duration.millis(500),
        });

        graph.add(conversation("c_1", [message(1)]));

        const fiber = yield* Effect.forkChild(platform.read(account, toRead));

        // The list goes at once, the read-back half a second after.
        for (
          let waited = 0;
          waited < 50 && graph.requests().length < 1;
          waited += 1
        ) {
          yield* Effect.promise(async () => {
            await delay(10);
          });
        }

        assert.lengthOf(graph.requests(), 1);

        yield* TestClock.adjust("499 millis");
        yield* Effect.promise(async () => {
          await delay(50);
        });

        assert.lengthOf(graph.requests(), 1);

        yield* TestClock.adjust("1 millis");

        const batch = yield* Fiber.join(fiber);

        assert.lengthOf(graph.requests(), 2);
        assert.lengthOf(batch.conversations, 1);
      })
    )
  );

  it.effect("stop for the run past the usage ceiling of Meta's headers", () =>
    atNow(
      Effect.gen(function* ceiling() {
        const { account, graph, platform } = yield* onGraph();

        graph.add(conversation("c_1", [message(1)]));
        graph.script.push("GET /v27.0/me/conversations", [
          json(
            {
              data: [
                {
                  id: "c_1",
                  participants: { data: [{ id: reader.id }] },
                  updated_time: "2026-11-16T09:01:00+0000",
                },
              ],
            },
            200,
            businessUsage(0)
          ),
        ]);

        const fiber = yield* Effect.forkChild(platform.read(account, toRead));

        const batch = yield* Fiber.join(fiber);

        assert.isTrue(batch.halted);
        assert.isFalse(batch.listedWhole);
        assert.lengthOf(batch.conversations, 0);
      })
    )
  );

  it.effect(
    "pause for a permission Meta refuses, and slow down when asked",
    () =>
      atNow(
        Effect.gen(function* refusals() {
          const { account, graph, platform } = yield* onGraph();

          graph.script.push("GET /v27.0/me/conversations", [
            graphError(10),
            graphError(200, 2_534_041),
            graphError(613),
            graphError(2, undefined, 500),
          ]);

          const tags = [];

          for (let n = 0; n < 4; n += 1) {
            const fiber = yield* Effect.forkChild(
              platform.read(account, toRead).pipe(Effect.flip)
            );

            const failure = yield* Fiber.join(fiber);

            tags.push(
              failure._tag === "ChannelUnreadable"
                ? `${failure._tag}:${failure.reason}`
                : failure._tag
            );
          }

          assert.deepStrictEqual(tags, [
            "ChannelUnreadable:paused",
            "ChannelUnreadable:paused",
            "RateLimited",
            "PlatformUnavailable",
          ]);
        })
      )
  );

  it.effect("call each way in on its host, with its credentials", () =>
    atNow(
      Effect.gen(function* hosts() {
        for (const way of [
          "messenger",
          "pageInstagram",
          "instagramLogin",
        ] as const) {
          const { account, graph, platform } = yield* onGraph(way);

          const fiber = yield* Effect.forkChild(platform.read(account, toRead));

          yield* Fiber.join(fiber);

          const [listed] = graph.requests();

          assert.strictEqual(listed?.path, "/v27.0/me/conversations");
          assert.strictEqual(
            listed?.query.get("platform"),
            way === "messenger" ? "messenger" : "instagram"
          );
          assert.strictEqual(
            listed?.query.has("appsecret_proof"),
            way !== "instagramLogin"
          );
        }
      })
    )
  );
});

describe("Meta's direct messages, sent", () => {
  it.effect("send an answer once, and read the id Meta gave", () =>
    atNow(
      Effect.gen(function* sent() {
        const { account, graph, platform } = yield* onGraph();

        graph.add(conversation("c_1", [message(1)]));

        const outcome = yield* platform.send(account, outgoing());

        assert.deepStrictEqual(outcome, {
          _tag: "sent",
          platformMessageId: "m_sent_1",
        });

        const request = graph
          .requests()
          .find(({ method }) => method === "POST");

        assert.strictEqual(request?.path, "/v27.0/me/messages");
        assert.lengthOf(graph.conversations()[0]?.messages ?? [], 2);
      })
    )
  );

  it.effect(
    "leave unconfirmed an answer whose reply was lost, before or after Meta acted",
    () =>
      atNow(
        Effect.gen(function* lost() {
          const { account, graph, platform } = yield* onGraph();

          graph.add(conversation("c_1", [message(1)]));
          graph.loseAnswer("POST /v27.0/me/messages");
          graph.dropBefore("POST /v27.0/me/messages");
          graph.script.push("POST /v27.0/me/messages", [
            json({ unexpected: true }),
          ]);

          const outcomes = [];

          for (let n = 0; n < 3; n += 1) {
            outcomes.push(yield* platform.send(account, outgoing()));
          }

          for (const outcome of outcomes) {
            assert.deepStrictEqual(outcome, {
              _tag: "unconfirmed",
              reason: "noResponse",
            });
          }

          // The scripted answer went first, then one carried out, then none.
          assert.lengthOf(graph.conversations()[0]?.messages ?? [], 2);
        })
      )
  );

  it.effect("say why Meta refused an answer", () =>
    atNow(
      Effect.gen(function* refused() {
        const { account, graph, platform } = yield* onGraph();

        graph.script.push("POST /v27.0/me/messages", [
          graphError(2, undefined, 500),
        ]);

        assert.deepStrictEqual(yield* platform.send(account, outgoing()), {
          _tag: "unconfirmed",
          reason: "noResponse",
        });

        // A refused token last: the channel then needs reconnecting.
        // Meta's own failures, and any answer Peal cannot read, may
        // follow a message that went out: never taken for not sent.
        const doubtful = [
          graphError(1),
          graphError(2),
          graphError(100, undefined, 400, true),
          graphError(9999),
          rawJson("not json", 400),
        ];

        graph.script.push("POST /v27.0/me/messages", doubtful);

        for (const _ of doubtful) {
          assert.deepStrictEqual(yield* platform.send(account, outgoing()), {
            _tag: "unconfirmed",
            reason: "noResponse",
          });
        }

        const cases = [
          [graphError(10, 2_018_278), "windowClosed"],
          [graphError(10, 2_018_065), "windowClosed"],
          [graphError(100, 2_018_001), "conversationGone"],
          [graphError(10, 2_534_022), "windowClosed"],
          [graphError(10, 2_018_108), "refused"],
          [graphError(551, 1_545_041), "refused"],
          [graphError(200, 1_545_041), "refused"],
          [graphError(200, 2_018_028), "refused"],
          [graphError(200, 2_534_041), "refused"],
          [graphError(100, 2_534_014), "conversationGone"],
          [graphError(613, 2_534_040), "rateLimited"],
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

  it.effect("resume by looking, never by sending", () =>
    atNow(
      Effect.gen(function* resumed() {
        const { account, graph, platform } = yield* onGraph();
        const mine = { id: facebookPageId, name: "Synthetic Page" };
        const { text } = outgoing();

        const resume = (
          messages: readonly FakeDirect[],
          changed: Partial<OutgoingDirect> = {}
        ) =>
          Effect.gen(function* looking() {
            graph.conversations().splice(0);
            graph.add(conversation("c_1", messages));

            const outcome = yield* platform.resume(account, outgoing(changed));

            assert.isFalse(
              graph.requests().some(({ method }) => method === "POST")
            );

            return outcome;
          });

        const unknown: MessageSendOutcome = {
          _tag: "unconfirmed",
          reason: "interrupted",
        };

        assert.deepStrictEqual(yield* resume([message(1)]), unknown);
        assert.deepStrictEqual(
          yield* resume([
            message(1),
            message(2, {
              createdTime: "2026-11-16T10:00:20+0000",
              from: mine,
              id: "m_mine",
              text,
            }),
          ]),
          { _tag: "sent", platformMessageId: "m_mine" }
        );
        assert.deepStrictEqual(
          yield* resume([
            message(2, {
              createdTime: "2026-11-16T10:00:20+0000",
              from: mine,
              id: "m_a",
              text,
            }),
            message(3, {
              createdTime: "2026-11-16T10:00:30+0000",
              from: mine,
              id: "m_b",
              text,
            }),
          ]),
          unknown
        );
        assert.deepStrictEqual(
          yield* resume(
            [
              message(2, {
                createdTime: "2026-11-16T10:00:20+0000",
                from: mine,
                id: "m_taken",
                text,
              }),
            ],
            { takenIds: ["m_taken"] }
          ),
          unknown
        );
        // Written before the message was, less a minute: not this one.
        assert.deepStrictEqual(
          yield* resume([
            message(2, {
              createdTime: "2026-11-16T09:58:00+0000",
              from: mine,
              id: "m_old",
              text,
            }),
          ]),
          unknown
        );
      })
    )
  );
});

describe("Meta's events for an account", () => {
  it.effect(
    "are asked for with the Page's fields, and stopped once nobody else follows",
    () =>
      atNow(
        Effect.gen(function* subscribed() {
          const { account, graph, platform } = yield* onGraph("messenger", {
            linkedInstagram: instagramUserId,
          });

          assert.strictEqual(
            yield* following(platform).follow(account),
            "done"
          );
          assert.strictEqual(graph.subscription(), "messages,message_echoes");

          const asked: string[][] = [];

          const kept = yield* following(platform).unfollow(
            account,
            (accounts) => {
              asked.push(
                accounts.map(
                  ({ accountId, platform: on }) => `${on}:${accountId}`
                )
              );

              return Effect.succeed(true);
            }
          );

          assert.strictEqual(kept, "unneeded");
          assert.deepStrictEqual(asked, [
            [`facebook:${facebookPageId}`, `instagram:${instagramUserId}`],
          ]);
          assert.strictEqual(graph.subscription(), "messages,message_echoes");

          const stopped = yield* following(platform).unfollow(account, () =>
            Effect.succeed(false)
          );

          assert.strictEqual(stopped, "done");
          assert.isUndefined(graph.subscription());
        })
      )
  );

  it.effect(
    "through Instagram Login are the account's own, without proof",
    () =>
      atNow(
        Effect.gen(function* ownApp() {
          const { account, graph, platform } = yield* onGraph("instagramLogin");

          assert.strictEqual(
            yield* following(platform).follow(account),
            "done"
          );

          const asked: string[][] = [];

          yield* following(platform).unfollow(account, (accounts) => {
            asked.push(accounts.map(({ accountId }) => accountId));

            return Effect.succeed(false);
          });

          assert.deepStrictEqual(asked, [[instagramUserId]]);
          assert.isUndefined(graph.subscription());
          assert.isFalse(
            graph.requests().some(({ query }) => query.has("appsecret_proof"))
          );
        })
      )
  );

  it.effect("through a Page ask after the Page the account is linked to", () =>
    atNow(
      Effect.gen(function* page() {
        const { account, platform } = yield* onGraph("pageInstagram", {
          me: facebookPageId,
        });

        const asked: string[][] = [];

        yield* following(platform).unfollow(account, (accounts) => {
          asked.push(
            accounts.map(({ accountId, platform: on }) => `${on}:${accountId}`)
          );

          return Effect.succeed(true);
        });

        assert.deepStrictEqual(asked, [
          [`instagram:${instagramUserId}`, `facebook:${facebookPageId}`],
        ]);
      })
    )
  );
});
