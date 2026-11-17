// Direct messages in the inbox, on memory: what the collection keeps and
// tells, what a member sends and how it is journalled, metered, sent once
// and settled, and what the retention deletes.
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Layer, Option, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { ChannelUnreadable } from "#engagement/application/channel-unreadable.ts";
import { CollectMessages } from "#engagement/application/collect-messages.ts";
import { EngagementMessages } from "#engagement/application/engagement-messages.ts";
import { MessageSettings } from "#engagement/application/message-settings.ts";
import { MessagesUngranted } from "#engagement/application/messages-ungranted.ts";
import { PurgeMessages } from "#engagement/application/purge-messages.ts";
import { ReceiveMessageEvents } from "#engagement/application/receive-message-events.ts";
import type { MessageEvent } from "#engagement/application/receive-message-events.ts";
import { SendMessage } from "#engagement/application/send-message.ts";
import { refreshConversation } from "#engagement/domain/conversation.ts";
import {
  followBox,
  postponeBoxRead,
  recordBoxRead,
} from "#engagement/domain/message-box.ts";
import { beginMessage } from "#engagement/domain/outgoing-message.ts";
import { MeteredUsage } from "#shared/application/metered-usage.ts";
import { Actor } from "#shared/domain/access.ts";
import type { Permission } from "#shared/domain/access.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  blueskyChannel,
  facebookChannel,
  makeMessageWorld,
  mastodonChannel,
} from "#test/engagement/fakes/message-world.ts";
import type { MessageWorld } from "#test/engagement/fakes/message-world.ts";
import {
  channelId,
  conversation,
  conversationId,
  conversationReading,
  directMessage,
  memberId,
  messageReading,
  messagedAt,
  participant,
  workspaceId,
} from "#test/engagement/support.ts";
import { FakeMetersLedger, fakeMeters } from "#test/shared/support.ts";

const actorWith = (...permissions: Permission[]) =>
  new Actor({
    permissions,
    subject: { _tag: "user", impersonatedBy: Option.none(), userId: memberId },
    workspaceId,
  });

const editor = actorWith(
  "engagement:read",
  "engagement:readMessages",
  "engagement:reply",
  "engagement:message"
);

// A viewer reads comments, never direct messages.
const viewer = actorWith("engagement:read");

// A member through an application (an MCP client, say), with every
// permission an editor holds.
const throughApp = new Actor({
  permissions: [...editor.permissions],
  subject: {
    _tag: "user",
    clientId: "synthetic-mcp-client",
    impersonatedBy: Option.none(),
    userId: memberId,
  },
  workspaceId,
});

const at = <A, E, R>(effect: Effect.Effect<A, E, R>, when = messagedAt) =>
  TestClock.setTime(DateTime.toEpochMillis(when)).pipe(Effect.andThen(effect));

// A world with conversation 1 on a channel of `platform`, its box
// followed before the conversation's messages were sent.
// A read of a box that lists `listed`, whole or cut short.
const listing =
  (listed: readonly string[], listedWhole = true) =>
  () =>
    Effect.succeed({
      conversations: [],
      halted: !listedWhole,
      listed: [...listed],
      listedWhole,
    });

const channels = {
  bluesky: blueskyChannel,
  facebook: facebookChannel,
  mastodon: mastodonChannel,
} as const;

const worldWith = (
  platform: keyof typeof channels = "mastodon",
  world: MessageWorld = makeMessageWorld()
) => {
  const started = conversation(1, { participants: [participant(1)] });
  const incoming = directMessage(1, {}, started);

  // Someone wrote: Peal answers, never starts.
  const talk = refreshConversation(
    started,
    conversationReading(1),
    [incoming],
    messagedAt
  );

  world.state.messages.set(incoming.id, incoming);

  world.state.channels.set(channelId(1), channels[platform]);
  world.state.conversations.set(talk.id, talk);

  return world;
};

const sending = (text: string, key?: string) =>
  EngagementMessages.use((messages) =>
    messages.send(editor, conversationId(1), text, Option.fromUndefinedOr(key))
  );

describe("the messages' collection", () => {
  it.effect("reads nothing where the server reads no messages", () => {
    const world = makeMessageWorld(new Set());

    world.state.boxes.set(
      channelId(1),
      followBox({ channelId: channelId(1), workspaceId }, messagedAt)
    );

    return at(
      Effect.gen(function* off() {
        yield* CollectMessages.use((collect) => collect.run(messagedAt));

        assert.lengthOf(world.state.reads, 0);
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "reads a channel only once a member in person turned its messages on, and forgets it when turned off",
    () => {
      const world = makeMessageWorld(new Set(["mastodon"]));

      world.state.channels.set(channelId(1), mastodonChannel);
      world.state.channels.set(channelId(2), {
        ...mastodonChannel,
        platform: "facebook",
      });

      const admin = actorWith("channel:connect", "engagement:readMessages");

      return at(
        Effect.gen(function* switches() {
          yield* CollectMessages.use((collect) => collect.run(messagedAt));

          assert.lengthOf(world.state.reads, 0);

          const refused = yield* MessageSettings.use((settings) =>
            settings.switchChannel(
              new Actor({
                permissions: ["channel:connect"],
                subject: throughApp.subject,
                workspaceId,
              }),
              channelId(1),
              true
            )
          ).pipe(Effect.flip);

          assert.strictEqual(refused._tag, "MessagesNeedPerson");

          const off = yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(2), true)
          ).pipe(Effect.flip);

          assert.strictEqual(off._tag, "MessageAbilityUnavailable");

          const on = yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), true)
          );

          assert.deepStrictEqual(
            on.channels.map(({ channelId: id }) => id),
            [channelId(1)]
          );

          yield* CollectMessages.use((collect) => collect.run(messagedAt));

          assert.deepStrictEqual(
            world.state.reads.map((read) => read.channelId),
            [channelId(1)]
          );

          world.state.conversations.set(conversationId(1), conversation(1));

          yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), false)
          );

          assert.strictEqual(world.state.conversations.size, 0);
          assert.isFalse(world.state.boxes.has(channelId(1)));
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "keeps a Bluesky channel's messages off until its account granted the chat scopes",
    () => {
      const world = makeMessageWorld(new Set(["bluesky"]));
      const admin = actorWith("channel:connect");

      world.state.channels.set(channelId(1), {
        ...blueskyChannel,
        scopes: ["atproto", "repo:app.bsky.feed.post?action=create"],
      });
      world.state.channels.set(channelId(2), blueskyChannel);

      return at(
        Effect.gen(function* grants() {
          const refused = yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), true)
          ).pipe(Effect.flip);

          assert.deepInclude(refused, {
            _tag: "MessageAbilityUnavailable",
            ability: "read",
            standing: "reconnect",
          });

          const on = yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(2), true)
          );

          assert.deepStrictEqual(
            on.channels.map(({ channelId: id }) => id),
            [channelId(2)]
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "deletes a kept conversation only once two whole listings in a row no longer show it, and none for an empty or partial listing",
    () => {
      const world = worldWith();

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, messagedAt)
      );

      // Each run two hours after the last, so the box is due.
      let run = messagedAt;

      const collected = Effect.suspend(() => {
        run = DateTime.addDuration(run, "2 hours");

        return at(
          CollectMessages.use((collect) => collect.run(run)),
          run
        );
      });

      return Effect.gen(function* listings() {
        world.state.read = listing([], false);
        yield* collected;

        // Partial, then empty: nothing is decided from them.
        world.state.read = listing([]);
        yield* collected;
        assert.strictEqual(world.state.conversations.size, 1);

        // Missed once, it stays; listed again, it is cleared.
        world.state.read = listing(["c9"]);
        yield* collected;
        assert.strictEqual(world.state.conversations.size, 1);

        world.state.read = listing(["c1", "c9"]);
        yield* collected;

        world.state.read = listing(["c9"]);
        yield* collected;
        assert.strictEqual(world.state.conversations.size, 1);

        // Missed by a second whole listing in a row, it goes.
        yield* collected;
        assert.strictEqual(world.state.conversations.size, 0);
      }).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "clears the miss of a conversation a halted listing shows, so a whole listing after does not delete it",
    () => {
      const world = worldWith();

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, messagedAt)
      );

      let run = messagedAt;

      const collected = Effect.suspend(() => {
        run = DateTime.addDuration(run, "2 hours");

        return at(
          CollectMessages.use((collect) => collect.run(run)),
          run
        );
      });

      return Effect.gen(function* sighted() {
        // Missed by a whole listing: marked.
        world.state.read = listing(["c9"]);
        yield* collected;

        // Shown by a listing that halted: seen, so no longer missed.
        world.state.read = listing(["c1"], false);
        yield* collected;

        // Missed by the next whole listing: marked again, and kept.
        world.state.read = listing(["c9"]);
        yield* collected;
        assert.strictEqual(world.state.conversations.size, 1);

        // A whole listing that comes back empty deletes nothing, however
        // often: the conversation goes by its time.
        world.state.read = listing([]);
        yield* collected;
        yield* collected;
        assert.strictEqual(world.state.conversations.size, 1);
      }).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "keeps no message sent before what Peal keeps, and never tells one again",
    () => {
      const world = makeMessageWorld();
      const followedAt = DateTime.subtractDuration(messagedAt, "60 days");

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, followedAt)
      );

      // A Mastodon thread read whole: a message 40 days old, and today's.
      world.state.read = () =>
        Effect.succeed({
          conversations: [
            conversationReading(1, {
              messages: [
                messageReading(1, {
                  sentAt: DateTime.subtractDuration(messagedAt, "40 days"),
                }),
                messageReading(2),
              ],
            }),
          ],
          halted: false,
          listed: ["c1"],
          listedWhole: true,
        });

      const nextDay = DateTime.addDuration(messagedAt, "1 day");

      return Effect.gen(function* rereads() {
        yield* at(CollectMessages.use((collect) => collect.run(messagedAt)));

        assert.deepStrictEqual(
          [...world.state.messages.values()].map(
            ({ platformMessageId }) => platformMessageId
          ),
          ["m2"]
        );

        yield* at(
          PurgeMessages.use((purging) => purging.purge),
          nextDay
        );
        yield* at(
          CollectMessages.use((collect) => collect.run(nextDay)),
          nextDay
        );

        assert.strictEqual(world.state.messages.size, 1);
        assert.deepStrictEqual(
          world.state.received.flatMap(({ messages }) =>
            messages.map(({ platformMessageId }) => platformMessageId)
          ),
          ["m2"]
        );
      }).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "keeps what a first read finds, and tells only what came after the channel was followed",
    () => {
      const world = makeMessageWorld();
      const followedAt = DateTime.subtractDuration(messagedAt, "1 hour");

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, followedAt)
      );

      world.state.read = () =>
        Effect.succeed({
          conversations: [
            conversationReading(1, {
              messages: [
                messageReading(1, {
                  sentAt: DateTime.subtractDuration(messagedAt, "2 days"),
                }),
                messageReading(2),
                messageReading(3, {
                  fromAccount: true,
                  senderPlatformId: Option.none(),
                }),
              ],
            }),
          ],
          halted: false,
          listed: [],
          listedWhole: false,
        });

      return at(
        Effect.gen(function* reads() {
          const report = yield* CollectMessages.use((collect) =>
            collect.run(messagedAt)
          );

          assert.strictEqual(report.read, 1);
          assert.strictEqual(world.state.conversations.size, 1);
          assert.strictEqual(world.state.messages.size, 3);
          assert.deepStrictEqual(
            world.state.received.flatMap(({ messages }) =>
              messages.map(({ platformMessageId }) => platformMessageId)
            ),
            ["m2"]
          );

          const [kept] = world.state.conversations.values();

          assert.isTrue(Option.isSome(kept?.lastIncomingAt ?? Option.none()));
          assert.isTrue(
            DateTime.isGreaterThan(
              world.state.boxes.get(channelId(1))?.nextReadAt ?? messagedAt,
              messagedAt
            )
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("deletes at once a message the platform says was deleted", () => {
    const world = worldWith();
    const kept = directMessage(1);

    world.state.messages.set(kept.id, kept);
    world.state.boxes.set(
      channelId(1),
      followBox({ channelId: channelId(1), workspaceId }, messagedAt)
    );
    world.state.read = () =>
      Effect.succeed({
        conversations: [
          conversationReading(1, {
            complete: false,
            deleted: ["m1"],
            messages: [],
            revision: "r9",
          }),
        ],
        halted: false,
        listed: [],
        listedWhole: false,
      });

    return at(
      Effect.gen(function* deletes() {
        yield* CollectMessages.use((collect) => collect.run(messagedAt));

        assert.strictEqual(world.state.messages.size, 0);
        assert.strictEqual(
          world.state.conversations.get(conversationId(1))?.revision,
          "r9"
        );
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect("keeps no conversation whose last message is past its time", () => {
    const world = makeMessageWorld();

    world.state.boxes.set(
      channelId(1),
      followBox({ channelId: channelId(1), workspaceId }, messagedAt)
    );
    world.state.read = () =>
      Effect.succeed({
        conversations: [
          conversationReading(1, {
            lastMessageAt: DateTime.subtractDuration(messagedAt, "31 days"),
          }),
        ],
        halted: false,
        listed: [],
        listedWhole: false,
      });

    return at(
      Effect.gen(function* old() {
        yield* CollectMessages.use((collect) => collect.run(messagedAt));

        assert.strictEqual(world.state.conversations.size, 0);
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "deletes a channel that left, and puts off one its platform did not answer",
    () => {
      const world = worldWith();

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, messagedAt)
      );
      world.state.boxes.set(
        channelId(2),
        followBox({ channelId: channelId(2), workspaceId }, messagedAt)
      );
      world.state.read = (request) =>
        Effect.fail(
          request.channelId === channelId(1)
            ? new ChannelUnreadable({ reason: "disconnected" })
            : new PlatformUnavailable()
        );

      return at(
        Effect.gen(function* fails() {
          const report = yield* CollectMessages.use((collect) =>
            collect.run(messagedAt)
          );

          assert.strictEqual(report.deferred, 2);
          assert.strictEqual(world.state.conversations.size, 0);
          assert.isFalse(world.state.boxes.has(channelId(1)));
          assert.deepStrictEqual(
            world.state.boxes.get(channelId(2))?.nextReadAt,
            DateTime.addDuration(messagedAt, "30 minutes")
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "turns a channel's messages off, and says so, once its account no longer grants what reading them takes",
    () => {
      const world = worldWith("bluesky");

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, messagedAt)
      );
      world.state.switchedOn.set(channelId(1), {
        channelId: channelId(1),
        enabledAt: messagedAt,
        enabledBy: Option.none(),
        workspaceId,
      });
      // Signed in again without the chat's permissions.
      world.state.read = () => Effect.fail(new MessagesUngranted());

      return at(
        Effect.gen(function* ungranted() {
          const report = yield* CollectMessages.use((collect) =>
            collect.run(messagedAt)
          );

          assert.strictEqual(report.deferred, 1);
          assert.strictEqual(world.state.conversations.size, 0);
          assert.isFalse(world.state.boxes.has(channelId(1)));
          assert.isFalse(world.state.switchedOn.has(channelId(1)));
          assert.deepStrictEqual(world.state.turnedOff, [
            { channelId: channelId(1), workspaceId },
          ]);
          // Its platform is asked to stop the account's events too.
          assert.deepStrictEqual(world.state.unfollows, [channelId(1)]);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );
});

describe("a message a member sends", () => {
  it.effect(
    "is journalled with its job, mentions the participants on Mastodon, and marks the conversation read",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* journals() {
          const message = yield* sending("Thanks for writing!");

          assert.strictEqual(
            message.text,
            "@reader1@social.example Thanks for writing!"
          );
          assert.deepStrictEqual(message.authorId, Option.some(memberId));
          assert.deepStrictEqual(world.state.jobs, [message.id]);
          assert.deepStrictEqual(
            world.state.conversations.get(conversationId(1))?.readAt,
            Option.some(messagedAt)
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("goes as written on Bluesky, within its chat's limit", () => {
    const world = worldWith("bluesky");

    return at(
      Effect.gen(function* bluesky() {
        assert.strictEqual((yield* sending(" Hello ")).text, "Hello");

        const refusal = yield* EngagementMessages.use((messages) =>
          messages.send(editor, conversationId(1), "a".repeat(1001))
        ).pipe(Effect.flip);

        assert.deepInclude(refusal, {
          _tag: "ReplyTooLong",
          maximum: 1000,
          unit: "graphemes",
        });
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect("is refused an empty text, or one longer than a status", () => {
    const world = worldWith();

    return at(
      Effect.gen(function* refused() {
        assert.strictEqual(
          (yield* sending(" \u0000 ").pipe(Effect.flip))._tag,
          "ReplyEmpty"
        );
        assert.deepInclude(yield* sending("a".repeat(490)).pipe(Effect.flip), {
          _tag: "ReplyTooLong",
          maximum: 500,
        });
        assert.lengthOf(world.state.jobs, 0);
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "waits for the one on its way, and answers a key sent again",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* once() {
          const first = yield* sending("Hello", "synthetic-key-1");
          const again = yield* sending("Hello", "synthetic-key-1");

          assert.strictEqual(again.id, first.id);
          assert.deepInclude(yield* sending("Another").pipe(Effect.flip), {
            _tag: "MessagePending",
            messageId: first.id,
          });
          assert.strictEqual(
            (yield* sending("Another", "synthetic-key-1").pipe(Effect.flip))
              ._tag,
            "ReplyKeyReused"
          );
          assert.lengthOf(world.state.jobs, 1);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "needs engagement:message, the channel able and its platform read",
    () => {
      const off = worldWith("mastodon", makeMessageWorld(new Set()));
      const bare = worldWith();

      bare.state.channels.set(channelId(1), {
        ...mastodonChannel,
        scopes: ["profile"],
      });

      return Effect.gen(function* refused() {
        const missing = yield* EngagementMessages.use((messages) =>
          messages.send(viewer, conversationId(1), "Hello")
        ).pipe(Effect.flip, Effect.provide(bare.layer));

        assert.deepInclude(missing, {
          _tag: "MissingPermission",
          permission: "engagement:message",
        });
        assert.deepInclude(
          yield* sending("Hello").pipe(Effect.flip, Effect.provide(bare.layer)),
          { _tag: "MessageAbilityUnavailable", standing: "reconnect" }
        );
        assert.deepInclude(
          yield* sending("Hello").pipe(Effect.flip, Effect.provide(off.layer)),
          { _tag: "MessageAbilityUnavailable", standing: "unsupported" }
        );
      }).pipe((effect) => at(effect));
    }
  );

  it.effect("is refused for a conversation of another workspace", () => {
    const world = worldWith();

    const stranger = new Actor({
      permissions: [
        "engagement:read",
        "engagement:readMessages",
        "engagement:message",
      ],
      subject: { _tag: "apiKey", apiKeyId: "synthetic-key" },
      workspaceId: WorkspaceIdSchema.make(
        "99999999-9999-4999-8999-999999999999"
      ),
    });

    return at(
      Effect.gen(function* elsewhere() {
        const refusal = yield* EngagementMessages.use((messages) =>
          messages.send(stranger, conversationId(1), "Hello")
        ).pipe(Effect.flip);

        assert.strictEqual(refusal._tag, "ConversationNotFound");

        const reading = yield* EngagementMessages.use((messages) =>
          messages.conversation(stranger, conversationId(1))
        ).pipe(Effect.flip);

        assert.strictEqual(reading._tag, "ConversationNotFound");
      })
    ).pipe(Effect.provide(world.layer));
  });
});

// A Mastodon conversation on a server that bills, its billing account
// allowed `allowed` messages this month.
const billed = (allowed: number) => {
  const meters = fakeMeters({ allowed: Option.some(allowed) });

  return {
    meters,
    world: worldWith("mastodon", makeMessageWorld(undefined, meters)),
  };
};

describe("a message past Meta's window", () => {
  const meta = new Set(["mastodon", "bluesky", "facebook"] as const);

  it.effect("is refused before anything is journalled or claimed", () => {
    const meters = fakeMeters({ allowed: Option.some(5) });
    const world = worldWith("facebook", makeMessageWorld(meta, meters));

    // A minute before Meta's 24 hours after the person last wrote.
    const closedAt = Option.map(
      Option.flatMap(
        Option.fromUndefinedOr(
          world.state.conversations.get(conversationId(1))
        ),
        ({ lastIncomingAt }) => lastIncomingAt
      ),
      (last) =>
        DateTime.addDuration(
          last,
          Duration.sum(Duration.hours(23), Duration.minutes(59))
        )
    ).pipe(Option.getOrThrow);

    return at(
      Effect.gen(function* shut() {
        const refusal = yield* sending("Hello").pipe(Effect.flip);

        assert.deepInclude(refusal, {
          _tag: "MessageAbilityUnavailable",
          closedAt,
          reason: "windowClosed",
          standing: "unsupported",
        });
        assert.strictEqual(world.state.outgoing.size, 0);
        assert.lengthOf(world.state.jobs, 0);
        assert.strictEqual(
          (yield* FakeMetersLedger.use(Ref.get)).used.get("outboundMessages") ??
            0,
          0
        );
      }),
      DateTime.addDuration(messagedAt, "24 hours")
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect(
    "is open within it, and answers a key sent again once it shut",
    () => {
      const world = worldWith("facebook", makeMessageWorld(meta));

      return Effect.gen(function* replayed() {
        const first = yield* at(
          sending("Hello", "synthetic-key-1"),
          DateTime.addDuration(messagedAt, "23 hours")
        );

        const again = yield* at(
          sending("Hello", "synthetic-key-1"),
          DateTime.addDuration(messagedAt, "25 hours")
        );

        assert.strictEqual(again.id, first.id);
        assert.lengthOf(world.state.jobs, 1);

        const other = yield* at(
          sending("Another", "synthetic-key-2"),
          DateTime.addDuration(messagedAt, "25 hours")
        ).pipe(Effect.flip);

        assert.deepInclude(other, { reason: "windowClosed" });
      }).pipe(Effect.provide(world.layer));
    }
  );
});

// The member's own session in the web app, as the API's handler says it.
const inSession = (actor: Actor, text = "Back on Monday, sorry") =>
  EngagementMessages.use((messages) =>
    messages.send(actor, conversationId(1), text, Option.none(), {
      inSession: true,
    })
  );

describe("a person's answer past Meta's 24 hours (Human Agent)", () => {
  const meta = new Set(["mastodon", "bluesky", "facebook"] as const);

  // When the person last wrote to conversation 1.
  const lastIncoming = Option.getOrThrow(
    Option.flatMap(
      Option.fromUndefinedOr(
        worldWith().state.conversations.get(conversationId(1))
      ),
      ({ lastIncomingAt }) => lastIncomingAt
    )
  );

  const after = (duration: Duration.Input) =>
    DateTime.addDuration(lastIncoming, duration);

  // The world's conversation 1, with Meta's Human Agent feature on or off.
  const metaWorld = (
    humanAgent = true,
    meters = fakeMeters({ allowed: Option.some(10) })
  ) => ({
    meters,
    world: worldWith("facebook", makeMessageWorld(meta, meters, humanAgent)),
  });

  // A minute before 24 hours, and before 7 days, after the person wrote.
  const standardClose = after(
    Duration.sum(Duration.hours(23), Duration.minutes(59))
  );

  const personClose = after(
    Duration.subtract(Duration.days(7), Duration.minutes(1))
  );

  // The MCP client the owner let read and answer messages.
  const application = {
    clientId: "synthetic-mcp-client",
    grantedAt: messagedAt,
    grantedBy: Option.some(memberId),
    workspaceId,
  };

  const staffId = UserIdSchema.make("33333333-3333-4333-8333-333333333333");

  const usedMessages = FakeMetersLedger.use(Ref.get).pipe(
    Effect.map(({ used }) => used.get("outboundMessages") ?? 0)
  );

  it.effect("is journalled for a member in their own session", () => {
    const { meters, world } = metaWorld();

    return at(
      Effect.gen(function* answered() {
        const message = yield* inSession(editor);

        assert.isTrue(message.byPerson);
        assert.strictEqual(world.state.outgoing.size, 1);
        assert.lengthOf(world.state.jobs, 1);
        assert.strictEqual(yield* usedMessages, 1);
      }),
      after("25 hours")
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect("records a person's answer within the 24 hours too", () => {
    const { meters, world } = metaWorld();

    return at(
      Effect.gen(function* answered() {
        assert.isTrue((yield* inSession(editor)).byPerson);
      }),
      after("23 hours")
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect("is open until a minute before the 7 days, and shut after", () => {
    const { meters, world } = metaWorld();

    return Effect.gen(function* edges() {
      const refusal = yield* at(
        inSession(editor),
        after(
          Duration.sum(
            Duration.days(6),
            Duration.sum(
              Duration.sum(Duration.hours(23), Duration.minutes(59)),
              Duration.seconds(30)
            )
          )
        )
      ).pipe(Effect.flip);

      assert.deepInclude(refusal, {
        _tag: "MessageAbilityUnavailable",
        closedAt: personClose,
        reason: "windowClosed",
        standing: "unsupported",
      });

      const late = yield* at(inSession(editor), after("8 days")).pipe(
        Effect.flip
      );

      assert.deepInclude(late, {
        closedAt: personClose,
        reason: "windowClosed",
      });
      assert.strictEqual(world.state.outgoing.size, 0);
      assert.lengthOf(world.state.jobs, 0);
      assert.strictEqual(yield* usedMessages, 0);

      const inTime = yield* at(
        inSession(editor),
        after(
          Duration.sum(
            Duration.days(6),
            Duration.sum(Duration.hours(23), Duration.minutes(58))
          )
        )
      );

      assert.isTrue(inTime.byPerson);
    }).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect(
    "is refused to anyone not in their own session, before anything is reserved",
    () => {
      const { meters, world } = metaWorld();

      // An API key, and staff acting as the member, with an editor's
      // permissions.
      const key = new Actor({
        permissions: [...editor.permissions],
        subject: { _tag: "apiKey", apiKeyId: "synthetic-key" },
        workspaceId,
      });

      const staff = new Actor({
        permissions: [...editor.permissions],
        subject: {
          _tag: "user",
          impersonatedBy: Option.some(staffId),
          userId: memberId,
        },
        workspaceId,
      });

      return at(
        Effect.gen(function* refused() {
          // An application allowed to send, which says it is a session.
          world.state.applications.push(application);

          for (const actor of [throughApp, key, staff]) {
            const refusal = yield* inSession(actor).pipe(Effect.flip);

            assert.deepInclude(refusal, {
              closedAt: standardClose,
              reason: "windowClosed",
            });
          }

          // The member as a rule or an automation acts for them, resolved
          // as they are now (`ActorsNow`): the same actor, without the
          // session the API's handler alone vouches for.
          const automated = yield* sending("Back on Monday, sorry").pipe(
            Effect.flip
          );

          assert.deepInclude(automated, {
            closedAt: standardClose,
            reason: "windowClosed",
          });
          assert.strictEqual(world.state.outgoing.size, 0);
          assert.lengthOf(world.state.jobs, 0);
          assert.strictEqual(yield* usedMessages, 0);
        }),
        after("25 hours")
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect(
    "is never a rule's, a tool's or a key's, even within the 24 hours",
    () => {
      const { meters, world } = metaWorld();

      return at(
        Effect.gen(function* notPerson() {
          world.state.applications.push(application);

          assert.isFalse((yield* sending("Hello")).byPerson);
          world.state.outgoing.clear();
          assert.isFalse((yield* inSession(throughApp)).byPerson);
        }),
        after("1 hour")
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect(
    "is refused where the app does not hold Meta's Human Agent feature",
    () => {
      const { meters, world } = metaWorld(false);

      return at(
        Effect.gen(function* off() {
          const refusal = yield* inSession(editor).pipe(Effect.flip);

          assert.deepInclude(refusal, {
            closedAt: standardClose,
            reason: "windowClosed",
          });
          assert.strictEqual(world.state.outgoing.size, 0);
          assert.strictEqual(yield* usedMessages, 0);
        }),
        after("25 hours")
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect(
    "is refused on a channel without the messaging permission, as any send",
    () => {
      const { meters, world } = metaWorld();

      world.state.channels.set(channelId(1), {
        ...facebookChannel,
        scopes: ["pages_show_list"],
      });

      return at(
        Effect.gen(function* ungranted() {
          const refusal = yield* inSession(editor).pipe(Effect.flip);

          assert.deepInclude(refusal, {
            _tag: "MessageAbilityUnavailable",
            standing: "reconnect",
          });
          assert.strictEqual(world.state.outgoing.size, 0);
        }),
        after("25 hours")
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect("shows a member when a person's answer stops being taken", () => {
    const { meters, world } = metaWorld();

    return at(
      Effect.gen(function* shown() {
        const detail = yield* EngagementMessages.use((messages) =>
          messages.conversation(editor, conversationId(1))
        );

        assert.isFalse(detail.window.open);
        assert.deepStrictEqual(
          detail.personWindow,
          Option.some({ closesAt: Option.some(personClose), open: true })
        );
      }),
      after("25 hours")
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect("shows none where the feature is off, or on Mastodon", () =>
    Effect.gen(function* none() {
      for (const world of [
        metaWorld(false).world,
        worldWith(
          "mastodon",
          makeMessageWorld(meta, MeteredUsage.layerUnmetered, true)
        ),
      ]) {
        const detail = yield* EngagementMessages.use((messages) =>
          messages.conversation(editor, conversationId(1))
        ).pipe(Effect.provide(world.layer));

        assert.deepStrictEqual(detail.personWindow, Option.none());
      }
    })
  );
});

describe("a message on a server that bills", () => {
  const ledger = FakeMetersLedger.use(Ref.get);

  it.effect("claims an outbound message, and refuses past the month's", () => {
    const { meters, world } = billed(1);

    world.state.conversations.set(
      conversationId(2),
      refreshConversation(
        conversation(2, { platformConversationId: "c2" }),
        conversationReading(2),
        [directMessage(2, {}, conversation(2))],
        messagedAt
      )
    );

    return at(
      Effect.gen(function* claims() {
        yield* sending("Hello");

        const refusal = yield* EngagementMessages.use((messages) =>
          messages.send(editor, conversationId(2), "Hello")
        ).pipe(Effect.flip);

        assert.deepInclude(refusal, {
          _tag: "AllowanceReached",
          meter: "outboundMessages",
        });
        assert.strictEqual(world.state.outgoing.size, 1);
        assert.strictEqual((yield* ledger).used.get("outboundMessages"), 1);
      })
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });

  it.effect(
    "gives it back when the channel's messages are turned off before it set out",
    () => {
      const { meters, world } = billed(5);
      const admin = actorWith("channel:connect");

      return at(
        Effect.gen(function* off() {
          yield* sending("Hello");

          yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), false)
          );

          assert.strictEqual(world.state.outgoing.size, 0);
          assert.strictEqual((yield* ledger).used.get("outboundMessages"), 0);
        })
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect(
    "gives it back when a read finds its channel disconnected before it set out",
    () => {
      const { meters, world } = billed(5);

      world.state.boxes.set(
        channelId(1),
        followBox({ channelId: channelId(1), workspaceId }, messagedAt)
      );
      world.state.read = () =>
        Effect.fail(new ChannelUnreadable({ reason: "disconnected" }));

      return at(
        Effect.gen(function* disconnected() {
          yield* sending("Hello");

          yield* CollectMessages.use((collect) => collect.run(messagedAt));

          assert.strictEqual(world.state.outgoing.size, 0);
          assert.strictEqual((yield* ledger).used.get("outboundMessages"), 0);
        })
      ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
    }
  );

  it.effect("gives it back when the message never went out", () => {
    const { meters, world } = billed(5);

    world.state.sending = { _tag: "failed", reason: "refused" };

    return at(
      Effect.gen(function* givesBack() {
        const message = yield* sending("Hello");

        assert.strictEqual(
          yield* SendMessage.use((send) => send.run(message.id)),
          "settled"
        );
        assert.strictEqual(
          world.state.outgoing.get(message.id)?.status._tag,
          "failed"
        );
        assert.strictEqual((yield* ledger).used.get("outboundMessages"), 0);
      })
    ).pipe(Effect.provide(Layer.merge(world.layer, meters)));
  });
});

describe("sending a message", () => {
  it.effect("calls the platform once, and settles it as it answered", () => {
    const world = worldWith();

    return at(
      Effect.gen(function* sends() {
        const message = yield* sending("Hello");

        yield* SendMessage.use((send) => send.run(message.id));

        assert.lengthOf(world.state.sent, 1);
        assert.deepInclude(world.state.outgoing.get(message.id)?.status, {
          _tag: "sent",
          platformMessageId: Option.some("m-sent"),
        });
        assert.deepStrictEqual(
          world.state.settled.map(({ id }) => id),
          [message.id]
        );
        // A run after it ended sends nothing.
        assert.strictEqual(
          yield* SendMessage.use((send) => send.run(message.id)),
          "superseded"
        );
        assert.lengthOf(world.state.sent, 1);
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "looks up, never sends again, a message whose answer was lost",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* lost() {
          const message = yield* sending("Hello");

          // A run set out, then the server stopped before the answer.
          world.state.outgoing.set(
            message.id,
            Result.getOrThrow(beginMessage(message, messagedAt))
          );

          yield* SendMessage.use((send) => send.run(message.id));

          assert.lengthOf(world.state.sent, 0);
          assert.lengthOf(world.state.resumed, 1);
          assert.strictEqual(
            world.state.outgoing.get(message.id)?.status._tag,
            "unconfirmed"
          );

          // A member checks the platform: it never went out.
          const confirmed = yield* EngagementMessages.use((messages) =>
            messages.confirm(editor, message.id, false)
          );

          assert.deepInclude(confirmed.status, { reason: "notSent" });
          assert.deepStrictEqual(world.state.cancelled, [message.id]);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "hands to a person a message no job settled within the hour",
    () => {
      const world = worldWith();

      return Effect.gen(function* stranded() {
        const message = yield* at(sending("Hello"));

        const handed = yield* at(
          SendMessage.use((send) => send.settleStranded),
          DateTime.addDuration(messagedAt, "2 hours")
        );

        assert.strictEqual(handed, 1);
        assert.strictEqual(
          world.state.outgoing.get(message.id)?.status._tag,
          "unconfirmed"
        );
        assert.deepStrictEqual(world.state.cancelled, [message.id]);
        // The workspace is told how it ended, as for any other.
        assert.deepStrictEqual(
          world.state.settled.map(({ id, status }) => [id, status._tag]),
          [[message.id, "unconfirmed"]]
        );
      }).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "leaves a stranded message to the call its gate claimed after it was listed",
    () => {
      const world = worldWith();
      const now = DateTime.addDuration(messagedAt, "2 hours");

      return Effect.gen(function* claimedMeanwhile() {
        const message = yield* at(sending("Hello"));

        // Listed as stranded, then its gate claims the call at once.
        world.state.afterListing = () => {
          world.state.claims.set(message.id, now);
        };

        const handed = yield* at(
          SendMessage.use((send) => send.settleStranded),
          now
        );

        assert.strictEqual(handed, 0);
        assert.strictEqual(
          world.state.outgoing.get(message.id)?.status._tag,
          "sending"
        );
        assert.deepStrictEqual(world.state.cancelled, []);
        assert.deepStrictEqual(world.state.settled, []);
      }).pipe(Effect.provide(world.layer));
    }
  );
});

describe("a workspace's conversations", () => {
  it.effect("are read with engagement:readMessages, a page at a time", () => {
    const world = worldWith();
    const kept = directMessage(1);

    world.state.messages.set(kept.id, kept);

    return at(
      Effect.gen(function* reads() {
        const page = yield* EngagementMessages.use((messages) =>
          messages.list(
            editor,
            { channelId: Option.none(), unread: false },
            { after: Option.none(), limit: 10 }
          )
        );

        assert.deepStrictEqual(
          page.items.map(({ conversation: talk }) => talk.id),
          [conversationId(1)]
        );

        const detail = yield* EngagementMessages.use((messages) =>
          messages.conversation(editor, conversationId(1))
        );

        assert.deepStrictEqual(
          detail.messages.map(({ id }) => id),
          [kept.id]
        );
        assert.deepStrictEqual(detail.abilities, {
          read: "available",
          send: "available",
        });
        assert.isTrue(detail.window.open);

        const refusal = yield* EngagementMessages.use((messages) =>
          messages.markRead(viewer, conversationId(1), true)
        ).pipe(Effect.flip);

        assert.strictEqual(refusal._tag, "MissingPermission");
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "lose each message 30 days after it was sent, and go once none is left",
    () => {
      const world = worldWith();

      const recent = directMessage(2, {
        sentAt: DateTime.addDuration(messagedAt, "20 days"),
      });

      world.state.messages.set(recent.id, recent);

      return Effect.gen(function* purges() {
        const first = yield* at(
          PurgeMessages.use((purging) => purging.purge),
          DateTime.addDuration(messagedAt, "31 days")
        );

        assert.deepStrictEqual(first, { conversations: 1, messages: 1 });
        assert.deepStrictEqual([...world.state.messages.keys()], []);
      }).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("are paged, the latest messages first, shown oldest first", () => {
    const world = worldWith();

    for (const n of [2, 3]) {
      const message = directMessage(n, {
        sentAt: DateTime.addDuration(messagedAt, Duration.minutes(n)),
      });

      world.state.messages.set(message.id, message);
    }

    return at(
      Effect.gen(function* pages() {
        const latest = yield* EngagementMessages.use((messages) =>
          messages.conversation(editor, conversationId(1), {
            before: Option.none(),
            limit: 2,
          })
        );

        assert.deepStrictEqual(
          latest.messages.map(({ platformMessageId }) => platformMessageId),
          ["m2", "m3"]
        );

        const older = yield* EngagementMessages.use((messages) =>
          messages.conversation(editor, conversationId(1), {
            before: latest.older,
            limit: 2,
          })
        );

        assert.deepStrictEqual(
          older.messages.map(({ platformMessageId }) => platformMessageId),
          ["m1"]
        );
        assert.isTrue(Option.isNone(older.older));
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "are refused to a viewer, and to an application the owner did not let read them",
    () => {
      const world = worldWith();
      const owner = actorWith("organization:secure");

      return at(
        Effect.gen(function* consent() {
          const byViewer = yield* EngagementMessages.use((messages) =>
            messages.list(
              viewer,
              { channelId: Option.none(), unread: false },
              { after: Option.none(), limit: 10 }
            )
          ).pipe(Effect.flip);

          assert.strictEqual(byViewer._tag, "MissingPermission");

          // The application lists who and how many, never what they say.
          const listed = yield* EngagementMessages.use((messages) =>
            messages.list(
              throughApp,
              { channelId: Option.none(), unread: false },
              { after: Option.none(), limit: 10 }
            )
          );

          assert.lengthOf(listed.items, 1);

          const read = yield* EngagementMessages.use((messages) =>
            messages.conversation(throughApp, conversationId(1))
          ).pipe(Effect.flip);

          const sent = yield* EngagementMessages.use((messages) =>
            messages.send(throughApp, conversationId(1), "Hello")
          ).pipe(Effect.flip);

          assert.deepStrictEqual(
            [read._tag, sent._tag],
            ["MessagesNeedConsent", "MessagesNeedConsent"]
          );

          yield* MessageSettings.use((settings) =>
            settings.allowApplication(owner, "synthetic-mcp-client", true)
          );

          const allowed = yield* EngagementMessages.use((messages) =>
            messages.conversation(throughApp, conversationId(1))
          );

          assert.lengthOf(allowed.messages, 1);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect("take no first message from Peal", () => {
    const world = worldWith();

    world.state.conversations.set(conversationId(1), conversation(1));

    return at(
      Effect.gen(function* first() {
        const refused = yield* sending("Hello").pipe(Effect.flip);

        assert.deepInclude(refused, {
          _tag: "MessageAbilityUnavailable",
          standing: "unsupported",
        });
      })
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "refuse a Mastodon message that mentions someone outside the conversation",
    () => {
      const world = worldWith();

      return at(
        Effect.gen(function* outside() {
          const refused = yield* sending("Thanks! cc @boss@other.example").pipe(
            Effect.flip
          );

          assert.deepInclude(refused, {
            _tag: "MessageMentionsOutside",
            mentions: ["@boss@other.example"],
          });
          assert.lengthOf(world.state.jobs, 0);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );
});

// A box never followed for its platform's events.
const boxWorld = () => {
  const world = makeMessageWorld();

  world.state.boxes.set(
    channelId(1),
    followBox({ channelId: channelId(1), workspaceId }, messagedAt)
  );

  return world;
};

const readNow = (when: DateTime.Utc) =>
  at(
    CollectMessages.use((collect) => collect.readBox(channelId(1), when)),
    when
  );

describe("one box read now", () => {
  it.effect(
    "asks the platform for the account's events first, then once a day",
    () => {
      const world = boxWorld();

      return at(
        Effect.gen(function* reads() {
          assert.strictEqual(yield* readNow(messagedAt), "read");
          assert.deepStrictEqual(world.state.follows, [channelId(1)]);
          assert.deepStrictEqual(
            world.state.reads.map((request) => request.channelId),
            [channelId(1)]
          );
          assert.deepStrictEqual(
            world.state.boxes.get(channelId(1))?.subscribedAt,
            Option.some(messagedAt)
          );

          yield* readNow(DateTime.addDuration(messagedAt, "23 hours"));

          assert.lengthOf(world.state.follows, 1);
          assert.lengthOf(world.state.reads, 2);

          yield* readNow(DateTime.addDuration(messagedAt, "24 hours"));

          assert.lengthOf(world.state.follows, 2);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "stops the events again when the box went while it asked for them",
    () => {
      const world = boxWorld();

      // The channel's messages are turned off while the platform answers.
      world.state.following = () =>
        Effect.sync(() => {
          world.state.boxes.delete(channelId(1));

          return "done" as const;
        });

      return at(
        Effect.gen(function* raced() {
          yield* CollectMessages.use((collect) =>
            collect.readBox(channelId(1), messagedAt)
          );

          assert.deepStrictEqual(world.state.follows, [channelId(1)]);
          assert.deepStrictEqual(world.state.unfollows, [channelId(1)]);
          assert.isFalse(world.state.boxes.has(channelId(1)));
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "reads all the same when the platform refuses the subscription",
    () => {
      const world = boxWorld();

      world.state.following = () => Effect.fail(new PlatformUnavailable());

      return at(
        Effect.gen(function* refused() {
          assert.strictEqual(
            yield* CollectMessages.use((collect) =>
              collect.readBox(channelId(1), messagedAt)
            ),
            "read"
          );
          assert.lengthOf(world.state.reads, 1);
          assert.deepStrictEqual(
            world.state.boxes.get(channelId(1))?.subscribedAt,
            Option.none()
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "reads nothing of a channel without a box, nor where the server reads no messages",
    () => {
      const off = boxWorld();
      const empty = makeMessageWorld();

      return at(
        Effect.gen(function* nothing() {
          assert.strictEqual(
            yield* CollectMessages.use((collect) =>
              collect.readBox(channelId(1), messagedAt)
            ).pipe(Effect.provide(makeMessageWorld(new Set()).layer)),
            "off"
          );
          assert.strictEqual(
            yield* CollectMessages.use((collect) =>
              collect.readBox(channelId(1), messagedAt)
            ).pipe(Effect.provide(empty.layer)),
            "missing"
          );
          assert.lengthOf(empty.state.reads, 0);
          assert.lengthOf(off.state.reads, 0);
        })
      );
    }
  );

  it.effect(
    "asks the platform to stop once the channel's box is gone, so two channels of one account turned off at once both see the other gone",
    () => {
      const world = makeMessageWorld(new Set(["mastodon"]));
      const admin = actorWith("channel:connect");
      const boxThen: boolean[] = [];

      world.state.channels.set(channelId(1), mastodonChannel);

      world.state.following = (request) =>
        Effect.sync(() => {
          boxThen.push(world.state.boxes.has(request.channelId));

          return "done" as const;
        });

      return at(
        Effect.gen(function* afterwards() {
          yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), true)
          );
          yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), false)
          );

          assert.deepStrictEqual(world.state.unfollows, [channelId(1)]);
          assert.deepStrictEqual(boxThen, [false]);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "asks the platform to stop when a channel's messages are turned off",
    () => {
      const world = makeMessageWorld(new Set(["mastodon"]));
      const admin = actorWith("channel:connect");

      world.state.channels.set(channelId(1), mastodonChannel);

      return at(
        Effect.gen(function* stops() {
          yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), true)
          );

          assert.lengthOf(world.state.unfollows, 0);

          // A platform that cannot be reached does not keep them on.
          world.state.following = () => Effect.fail(new PlatformUnavailable());

          yield* MessageSettings.use((settings) =>
            settings.switchChannel(admin, channelId(1), false)
          );

          assert.deepStrictEqual(world.state.unfollows, [channelId(1)]);
          assert.isFalse(world.state.boxes.has(channelId(1)));
        })
      ).pipe(Effect.provide(world.layer));
    }
  );
});

const otherWorkspace = WorkspaceIdSchema.make(
  "33333333-3333-4333-8333-333333333333"
);

// A Facebook Page connected in two workspaces, each with its messages on
// and a conversation holding messages m1 and m2; and a channel whose
// messages are off.
const pageWorld = () => {
  const world = makeMessageWorld();

  world.state.accounts.set("facebook:page-1", [
    { channelId: channelId(1), connection: Option.none(), workspaceId },
    {
      channelId: channelId(2),
      connection: Option.none(),
      workspaceId: otherWorkspace,
    },
  ]);
  world.state.accounts.set("facebook:page-off", [
    { channelId: channelId(3), connection: Option.none(), workspaceId },
  ]);

  for (const [n, inWorkspace] of [
    [1, workspaceId],
    [2, otherWorkspace],
  ] as const) {
    const box = followBox(
      { channelId: channelId(n), workspaceId: inWorkspace },
      messagedAt
    );

    world.state.boxes.set(
      channelId(n),
      recordBoxRead(box, Option.none(), messagedAt, messagedAt)
    );

    const talk = conversation(n, {}, box);

    world.state.conversations.set(talk.id, talk);

    for (const m of [1, 2]) {
      const message = directMessage(
        10 * n + m,
        { platformMessageId: `m${m}` },
        talk
      );

      world.state.messages.set(message.id, message);
    }
  }

  return world;
};

const receive = (events: readonly MessageEvent[]) =>
  ReceiveMessageEvents.use((receiving) => receiving.receive(events));

const event = (changed: Partial<MessageEvent> = {}): MessageEvent => ({
  accountId: "page-1",
  deleted: false,
  messageId: Option.some("m1"),
  platform: "facebook",
  ...changed,
});

describe("one box read now, against its schedule", () => {
  it.effect("calls nothing while a refusal's hold lasts", () => {
    const world = boxWorld();
    const box = world.state.boxes.get(channelId(1));

    if (box !== undefined) {
      world.state.boxes.set(
        channelId(1),
        postponeBoxRead(box, messagedAt, Duration.minutes(15))
      );
    }

    const later = DateTime.addDuration(messagedAt, "10 minutes");

    return at(
      Effect.gen(function* held() {
        assert.strictEqual(
          yield* CollectMessages.use((collect) =>
            collect.readBox(channelId(1), later)
          ),
          "deferred"
        );
        assert.lengthOf(world.state.reads, 0);
        assert.lengthOf(world.state.follows, 0);
      }),
      later
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "keeps the earlier read an event asked for while it was reading",
    () => {
      const world = boxWorld();
      const during = DateTime.addDuration(messagedAt, "30 seconds");
      const box = world.state.boxes.get(channelId(1));

      // Read a moment ago: due again in an hour.
      if (box !== undefined) {
        world.state.boxes.set(
          channelId(1),
          recordBoxRead(box, Option.none(), messagedAt, messagedAt)
        );
      }

      // While the platform answers, an event brings the box to `during`.
      world.state.read = () =>
        world.store.bringForward(channelId(1), during).pipe(
          Effect.orDie,
          Effect.as({
            conversations: [],
            halted: false,
            listed: [],
            listedWhole: false,
          })
        );

      return at(
        Effect.gen(function* moved() {
          // Read now, as an earlier event asked: left alone, its next
          // read would be an hour on, not `during`.
          const now = DateTime.addDuration(messagedAt, "10 seconds");

          yield* at(
            CollectMessages.use((collect) =>
              collect.readBox(channelId(1), now)
            ),
            now
          );

          assert.deepStrictEqual(
            world.state.boxes.get(channelId(1))?.nextReadAt,
            during
          );
        })
      ).pipe(Effect.provide(world.layer));
    }
  );
});

describe("a platform's events", () => {
  it.effect("bring the box forward, and start one read of it a slot", () => {
    const world = pageWorld();
    const when = DateTime.addDuration(messagedAt, "3 seconds");

    return at(
      Effect.gen(function* nudged() {
        assert.strictEqual(yield* receive([event(), event()]), "taken");

        assert.deepStrictEqual(
          world.state.boxes.get(channelId(1))?.nextReadAt,
          when
        );
        assert.deepStrictEqual(
          world.state.boxes.get(channelId(2))?.nextReadAt,
          when
        );

        // Four seconds later, in the same ten: no second read.
        yield* at(receive([event()]), DateTime.addDuration(when, "4 seconds"));

        assert.deepStrictEqual(world.state.boxReads, [
          { channelId: channelId(1), slot: "2026-11-12T10:00:00.000Z" },
          { channelId: channelId(2), slot: "2026-11-12T10:00:00.000Z" },
        ]);

        // Ten seconds on, another.
        yield* at(receive([event()]), DateTime.addDuration(when, "10 seconds"));

        assert.lengthOf(world.state.boxReads, 4);

        // Nothing that was kept changed.
        assert.strictEqual(world.state.messages.size, 4);
      }),
      when
    ).pipe(Effect.provide(world.layer));
  });

  it.effect(
    "delete the message taken back, in every workspace that connected the account, and no other",
    () => {
      const world = pageWorld();

      return at(
        Effect.gen(function* deleted() {
          yield* receive([event({ deleted: true })]);

          assert.deepStrictEqual(
            [...world.state.messages.values()]
              .map(
                ({ channelId: id, platformMessageId }) =>
                  `${id}:${platformMessageId}`
              )
              .toSorted(),
            [`${channelId(1)}:m2`, `${channelId(2)}:m2`]
          );

          // A deletion without a message's id deletes nothing.
          yield* receive([event({ deleted: true, messageId: Option.none() })]);

          assert.strictEqual(world.state.messages.size, 2);
        })
      ).pipe(Effect.provide(world.layer));
    }
  );

  it.effect(
    "write nothing for an account unknown, or a channel whose messages are off",
    () => {
      const world = pageWorld();

      return at(
        Effect.gen(function* ignored() {
          const before = new Map(world.state.boxes);

          assert.strictEqual(
            yield* receive([
              event({ accountId: "page-unknown", deleted: true }),
              event({ accountId: "page-off", deleted: true }),
              event({ platform: "instagram", deleted: true }),
            ]),
            "ignored"
          );

          assert.deepStrictEqual(world.state.boxes, before);
          assert.lengthOf(world.state.boxReads, 0);
          assert.strictEqual(world.state.messages.size, 4);
        }),
        DateTime.addDuration(messagedAt, "1 minute")
      ).pipe(Effect.provide(world.layer));
    }
  );
});
