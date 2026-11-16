// A chat connects with no sign-in page: a Discord webhook's address, or a
// Telegram bot's token and a chat, checked on the platform, then kept
// encrypted like any channel's token. It is a channel like any other for
// the plan.
import { assert, layer } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Ref } from "effect";

import { ChannelAllowance } from "#channels/application/channel-allowance.ts";
import { ChannelEvents } from "#channels/application/channel-events.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { decryptTokens } from "#channels/application/channel-tokens.ts";
import { ChatRefused } from "#channels/application/chat-refused.ts";
import { ChatVerifier } from "#channels/application/chat-verifier.ts";
import type {
  ChatSignIn,
  VerifiedChat,
} from "#channels/application/chat-verifier.ts";
import { ConnectChat } from "#channels/application/connect-chat.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import { MemoryChatConnectPace } from "#channels/infrastructure/memory-chat-connect-pace.ts";
import { SqlChannelLocks } from "#channels/infrastructure/sql-channel-locks.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  actorIn,
  DatabaseTest,
  freshChannel,
  freshWorkspace,
  syntheticCredentials,
  TokenCipherTest,
} from "#test/channels/support.ts";

// How many times a platform was asked.
const verified = Ref.makeUnsafe(0);

// What a Discord webhook's address leads to: `/1/…` and `/2/…` two
// webhooks of one channel, `/3/…` another channel's, `down` no answer;
// anything else is no webhook.
const discordAnswer = (
  address: string
): Effect.Effect<VerifiedChat, ChatRefused | PlatformUnavailable> => {
  if (address.includes("down")) {
    return Effect.fail(new PlatformUnavailable());
  }

  const match = /\/webhooks\/(?<id>\d)\//u.exec(address)?.groups?.["id"];

  if (match === undefined) {
    return Effect.fail(new ChatRefused({ reason: "addressNotAWebhook" }));
  }

  // Webhook 6, in channel 309 from the start.
  if (address.includes("/webhooks/6/")) {
    return Effect.succeed({
      accountId: "200/309",
      displayName: Option.some("Synthetic announcements"),
      handle: "Synthetic announcements",
      platform: "discord",
      secret: Redacted.make("6/synthetic-token"),
    });
  }

  // Webhook 5, which a server's managers moved to channel 309.
  if (address.includes("/webhooks/5/moved")) {
    return Effect.succeed({
      accountId: "200/309",
      displayName: Option.some("Synthetic moved"),
      handle: "Synthetic moved",
      platform: "discord",
      secret: Redacted.make("5/synthetic-token"),
    });
  }

  return Effect.succeed({
    accountId: match === "3" ? "200/302" : "200/301",
    displayName: Option.some("Synthetic \u0000news\uD800"),
    handle: "Synthetic news",
    platform: "discord",
    secret: Redacted.make(`${match}/synthetic-token`),
  });
};

// A sign-in with a Discord webhook's address.
const discordAt = (address: string) => ({
  platform: "discord" as const,
  webhookUrl: Redacted.make(address),
});

const answerFor = (
  signIn: ChatSignIn
): Effect.Effect<VerifiedChat, ChatRefused | PlatformUnavailable> =>
  signIn.platform === "discord"
    ? discordAnswer(Redacted.value(signIn.webhookUrl))
    : Effect.succeed({
        accountId: "-100500",
        displayName: Option.some("Synthetic channel"),
        handle: "@synthetic_channel",
        platform: "telegram",
        secret: signIn.botToken,
      });

const VerifierTest = Layer.succeed(
  ChatVerifier,
  ChatVerifier.of({
    verify: (signIn) =>
      Ref.update(verified, (count) => count + 1).pipe(
        Effect.andThen(answerFor(signIn))
      ),
  })
);

// What billing was told, and a plan of two channels.
const counted = Ref.makeUnsafe<readonly WorkspaceId[]>([]);

const AllowanceTest = Layer.succeed(
  ChannelAllowance,
  ChannelAllowance.of({
    channels: () => Effect.succeed(Option.some(2)),
    counted: (workspaceId, pooled) =>
      pooled.pipe(
        Effect.flatMap(() =>
          Ref.update(counted, (told) => [...told, workspaceId])
        )
      ),
    passedThrough: () => Effect.succeedNone,
    sharedWith: () => Effect.succeed([]),
    sharingIn: () => Effect.succeed(new Map()),
  })
);

// What the workspace's webhooks and contexts were told: each channel
// connected, and whether it was a reconnection.
const told = Ref.makeUnsafe<readonly (readonly [string, boolean])[]>([]);

const EventsTest = Layer.succeed(
  ChannelEvents,
  ChannelEvents.of({
    connected: (channel, reconnected) =>
      Ref.update(told, (before) => [
        ...before,
        [channel.id, reconnected] as const,
      ]),
    disabled: () => Effect.void,
    disconnected: () => Effect.void,
    enabled: () => Effect.void,
  })
);

const ConnectChatTest = ConnectChat.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      DrizzleChannelRepository,
      EventsTest,
      SqlChannelLocks,
      AllowanceTest,
      VerifierTest,
      MemoryChatConnectPace
    )
  ),
  Layer.provideMerge(TokenCipherTest),
  Layer.provideMerge(DatabaseTest)
);

const manager = (workspaceId: WorkspaceId) =>
  actorIn(workspaceId, ["channel:read", "channel:connect"]);

const webhook = (id = 1) => ({
  platform: "discord" as const,
  webhookUrl: Redacted.make(
    `https://discord.com/api/webhooks/${String(id)}/synthetic-token`
  ),
});

layer(ConnectChatTest)("connecting a chat", (it) => {
  it.effect(
    "adds the chat as a channel, its secret sealed, counted and told",
    () =>
      Effect.gen(function* added() {
        const workspaceId = yield* freshWorkspace;
        const chats = yield* ConnectChat;
        const repository = yield* ChannelRepository;

        const channel = yield* chats.connect(
          manager(workspaceId),
          webhook(),
          Option.none()
        );

        assert.strictEqual(channel.platform, "discord");
        assert.strictEqual(channel.accountId, "200/301");
        assert.strictEqual(channel.handle, "Synthetic news");
        // The platform's text, kept clean: no NUL, and half a surrogate
        // pair made the replacement character.
        assert.deepStrictEqual(
          channel.displayName,
          Option.some("Synthetic news\uFFFD")
        );
        assert.deepStrictEqual(channel.token, { _tag: "nonExpiring" });

        const stored = yield* repository.credentials(channel.id);

        assert(Option.isSome(stored));
        assert.notInclude(stored.value.accessToken, "synthetic");

        const tokens = yield* decryptTokens(stored.value, channel.id);

        assert.strictEqual(
          Redacted.value(tokens.accessToken),
          "1/synthetic-token"
        );

        // Bound to the channel: it opens for no other id.
        const other = yield* freshChannel(workspaceId);

        const elsewhere = yield* decryptTokens(stored.value, other.id).pipe(
          Effect.flip
        );

        assert.strictEqual(elsewhere._tag, "TokenAuthenticationFailed");
        assert.strictEqual((yield* Ref.get(counted)).at(-1), workspaceId);
        assert.deepStrictEqual((yield* Ref.get(told)).at(-1), [
          channel.id,
          false,
        ]);
      })
  );

  it.effect("reconnects the chat the workspace has, with the new secret", () =>
    Effect.gen(function* again() {
      const workspaceId = yield* freshWorkspace;
      const chats = yield* ConnectChat;
      const repository = yield* ChannelRepository;

      const first = yield* chats.connect(
        manager(workspaceId),
        webhook(1),
        Option.none()
      );

      const billed = (yield* Ref.get(counted)).length;

      // Another webhook of the same channel.
      const second = yield* chats.connect(
        manager(workspaceId),
        webhook(2),
        Option.none()
      );

      assert.strictEqual(second.id, first.id);
      assert.lengthOf(yield* repository.list(workspaceId), 1);
      assert.lengthOf(yield* Ref.get(counted), billed);
      assert.deepStrictEqual((yield* Ref.get(told)).at(-1), [first.id, true]);

      const stored = yield* repository.credentials(first.id);

      assert(Option.isSome(stored));

      const tokens = yield* decryptTokens(stored.value, first.id);

      assert.strictEqual(
        Redacted.value(tokens.accessToken),
        "2/synthetic-token"
      );
    })
  );

  it.effect(
    "reconnects the channel named, only with a secret of its chat",
    () =>
      Effect.gen(function* named() {
        const workspaceId = yield* freshWorkspace;
        const chats = yield* ConnectChat;

        const first = yield* chats.connect(
          manager(workspaceId),
          webhook(1),
          Option.none()
        );

        const again = yield* chats.connect(
          manager(workspaceId),
          webhook(2),
          Option.some(first.id)
        );

        assert.strictEqual(again.id, first.id);

        const mismatch = yield* chats
          .connect(manager(workspaceId), webhook(3), Option.some(first.id))
          .pipe(Effect.flip);

        assert.strictEqual(mismatch._tag, "ReconnectAccountMismatch");

        // A channel of another platform is not one to reconnect so.
        const missing = yield* chats
          .connect(
            manager(workspaceId),
            {
              botToken: Redacted.make("1:synthetic"),
              chat: "@synthetic_channel",
              platform: "telegram",
            },
            Option.some(first.id)
          )
          .pipe(Effect.flip);

        assert.strictEqual(missing._tag, "ChannelNotFound");
      })
  );

  it.effect(
    "follows a webhook moved to another channel, adding no channel",
    () =>
      Effect.gen(function* moved() {
        const workspaceId = yield* freshWorkspace;
        const chats = yield* ConnectChat;
        const repository = yield* ChannelRepository;

        const first = yield* chats.connect(
          manager(workspaceId),
          {
            platform: "discord",
            webhookUrl: Redacted.make(
              "https://discord.com/api/webhooks/5/synthetic-token"
            ),
          },
          Option.none()
        );

        const billed = (yield* Ref.get(counted)).length;

        assert.strictEqual(first.accountId, "200/301");

        for (const reconnecting of [Option.none(), Option.some(first.id)]) {
          const again = yield* chats.connect(
            manager(workspaceId),
            {
              platform: "discord",
              webhookUrl: Redacted.make(
                "https://discord.com/api/webhooks/5/moved"
              ),
            },
            reconnecting
          );

          assert.strictEqual(again.id, first.id);
          assert.strictEqual(again.accountId, "200/309");
        }

        const listed = yield* repository.list(workspaceId);

        assert.lengthOf(listed, 1);
        assert.strictEqual(listed[0]?.accountId, "200/309");
        assert.lengthOf(yield* Ref.get(counted), billed);
      })
  );

  it.effect(
    "refuses to move a channel onto another channel's account, its webhook moved there",
    () =>
      Effect.gen(function* taken() {
        const workspaceId = yield* freshWorkspace;
        const chats = yield* ConnectChat;
        const repository = yield* ChannelRepository;

        const news = yield* chats.connect(
          manager(workspaceId),
          discordAt("https://discord.com/api/webhooks/5/synthetic-token"),
          Option.none()
        );

        const announcements = yield* chats.connect(
          manager(workspaceId),
          discordAt("https://discord.com/api/webhooks/6/synthetic-token"),
          Option.none()
        );

        // Webhook 5 moved into the channel the second already posts in.
        const refused = yield* chats
          .connect(
            manager(workspaceId),
            discordAt("https://discord.com/api/webhooks/5/moved"),
            Option.some(news.id)
          )
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "ReconnectAccountMismatch");

        const listed = yield* repository.list(workspaceId);

        assert.deepStrictEqual(
          new Map(listed.map(({ accountId, id }) => [id, accountId])),
          new Map([
            [news.id, "200/301"],
            [announcements.id, "200/309"],
          ])
        );
      })
  );

  it.effect(
    "refuses a new chat once the plan is full, before the platform is asked",
    () =>
      Effect.gen(function* full() {
        const workspaceId = yield* freshWorkspace;
        const chats = yield* ConnectChat;
        const repository = yield* ChannelRepository;

        for (const _ of [1, 2]) {
          const channel = yield* freshChannel(workspaceId);

          yield* repository.insert(channel, syntheticCredentials(channel));
        }

        const asked = yield* Ref.get(verified);

        const refused = yield* chats
          .connect(manager(workspaceId), webhook(), Option.none())
          .pipe(Effect.flip);

        assert.strictEqual(refused._tag, "PlanLimitReached");
        assert.strictEqual(yield* Ref.get(verified), asked);
      })
  );

  it.effect("passes on the platform's refusal, keeping nothing", () =>
    Effect.gen(function* refusal() {
      const workspaceId = yield* freshWorkspace;
      const chats = yield* ConnectChat;
      const repository = yield* ChannelRepository;

      const refused = yield* chats
        .connect(
          manager(workspaceId),
          {
            platform: "discord",
            webhookUrl: Redacted.make("https://example.com/synthetic"),
          },
          Option.none()
        )
        .pipe(Effect.flip);

      assert.deepStrictEqual(
        refused,
        new ChatRefused({ reason: "addressNotAWebhook" })
      );
      assert.lengthOf(yield* repository.list(workspaceId), 0);
    })
  );

  it.effect("needs channel:connect", () =>
    Effect.gen(function* permission() {
      const workspaceId = yield* freshWorkspace;
      const chats = yield* ConnectChat;

      const refused = yield* chats
        .connect(
          actorIn(workspaceId, ["channel:read"]),
          webhook(),
          Option.none()
        )
        .pipe(Effect.flip);

      assert.strictEqual(refused._tag, "MissingPermission");
    })
  );

  it.effect("takes 30 tries an hour from a workspace", () =>
    Effect.gen(function* paced() {
      const workspaceId = yield* freshWorkspace;
      const chats = yield* ConnectChat;

      const down = {
        platform: "discord" as const,
        webhookUrl: Redacted.make(
          "https://discord.com/api/webhooks/1/synthetic-down"
        ),
      };

      for (const _ of Array.from({ length: 30 })) {
        const failed = yield* chats
          .connect(manager(workspaceId), down, Option.none())
          .pipe(Effect.flip);

        assert.strictEqual(failed._tag, "PlatformUnavailable");
      }

      const limited = yield* chats
        .connect(manager(workspaceId), webhook(), Option.none())
        .pipe(Effect.flip);

      assert.strictEqual(limited._tag, "ChatConnectLimited");
    })
  );
});
