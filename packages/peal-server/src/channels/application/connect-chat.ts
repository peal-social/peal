import { Context, DateTime, Effect, Layer, Option } from "effect";

import {
  connectChannel,
  reconnect as reconnectChannel,
} from "#channels/domain/channel.ts";
import type { Channel, ConnectedAccount } from "#channels/domain/channel.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { Ids, newId } from "#shared/application/ids.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";
import { storableLine } from "#shared/domain/platform-text.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";

import { ChannelAllowance } from "./channel-allowance.ts";
import { ChannelEvents } from "./channel-events.ts";
import { ChannelLocks } from "./channel-locks.ts";
import { ChannelNotFound } from "./channel-not-found.ts";
import { ChannelRepository } from "./channel-repository.ts";
import { channelRoomOf } from "./channel-room.ts";
import { encryptTokens } from "./channel-tokens.ts";
import type { ChatConnectLimited } from "./chat-connect-limited.ts";
import { ChatConnectPace } from "./chat-connect-pace.ts";
import type { ChatRefused } from "./chat-refused.ts";
import { ChatVerifier } from "./chat-verifier.ts";
import type { ChatSignIn, VerifiedChat } from "./chat-verifier.ts";
import type { MissingTokenKey } from "./missing-token-key.ts";
import type { IssuedTokens } from "./platform-authorizer.ts";
import { ReconnectAccountMismatch } from "./reconnect-account-mismatch.ts";
import { TokenCipher } from "./token-cipher.ts";

// The longest a chat's name is kept, as a platform's handle and name are.
const maxNameLength = 200;

export type ConnectChatFailure =
  | ChannelNotFound
  | ChatConnectLimited
  | ChatRefused
  | DatabaseError
  | MissingPermission
  | MissingTokenKey
  | PlanLimitReached
  | PlatformUnavailable
  | ReconnectAccountMismatch;

// The secret every call carries, kept as the channel's token: it lasts
// until its member deletes the webhook or revokes the bot's token, and
// nothing renews it.
const tokensOf = (chat: VerifiedChat): IssuedTokens => ({
  accessToken: chat.secret,
  expiresAt: Option.none(),
  refreshToken: Option.none(),
  renewable: false,
  scopes: [],
});

// What the platform told of the chat, made storable: its text may hold
// anything a member typed.
const connectedOf = (chat: VerifiedChat): ConnectedAccount => ({
  avatarUrl: Option.none(),
  connection: Option.none(),
  displayName: chat.displayName.pipe(
    Option.map((name) => storableLine(name, maxNameLength)),
    Option.filter((name) => name !== "")
  ),
  handle: storableLine(chat.handle, maxNameLength),
  scopes: [],
  token: { _tag: "nonExpiring" },
});

/**
 * Connects a chat to the actor's workspace, as a channel that takes posts,
 * with the secret its member pastes, without a sign-in page: a Discord
 * channel by its webhook's address, a Telegram channel or group by the
 * member's bot and the chat. The platform is asked whether the secret
 * posts there (`ChatVerifier`), and only then is it kept, encrypted for
 * the channel as a platform's token is. One channel per chat per
 * workspace: the same chat again reconnects its channel with the new
 * secret, and `reconnecting` names a channel the secret must reach again.
 * A new chat needs room in the plan, checked before the platform is
 * called when the workspace has no chat of that platform, and is counted
 * for billing like any channel. A workspace tries 30 times an hour
 * (`ChatConnectPace`). Needs channel:connect.
 */
export class ConnectChat extends Context.Service<
  ConnectChat,
  {
    readonly connect: (
      actor: Actor,
      signIn: ChatSignIn,
      reconnecting: Option.Option<ChannelId>
    ) => Effect.Effect<Channel, ConnectChatFailure>;
  }
>()("peal-server/channels/application/ConnectChat") {
  static readonly layer = Layer.effect(
    ConnectChat,
    Effect.gen(function* ConnectChatLive() {
      const channels = yield* ChannelRepository;
      const allowance = yield* ChannelAllowance;
      const events = yield* ChannelEvents;
      const locks = yield* ChannelLocks;
      const cipher = yield* TokenCipher;
      const verifier = yield* ChatVerifier;
      const ids = yield* Ids;
      const pace = yield* ChatConnectPace;
      const withCipher = Effect.provideService(TokenCipher, cipher);

      const { insertCounted, roomForChannel } = channelRoomOf(
        channels,
        allowance
      );

      // The channel takes the new secret, under its lock, as a reconnected
      // account's tokens are saved.
      const reconnectTo = (existing: Channel, chat: VerifiedChat) =>
        locks.withLock(
          existing.id,
          Effect.gen(function* reconnectLocked() {
            const current = yield* channels.findById(
              existing.workspaceId,
              existing.id
            );

            const channel = reconnectChannel(
              Option.getOrElse(current, () => existing),
              connectedOf(chat),
              yield* DateTime.now
            );

            const credentials = yield* encryptTokens(
              tokensOf(chat),
              channel.id
            ).pipe(withCipher);

            yield* channels.addingTo(
              channel.workspaceId,
              channels
                .update(channel, Option.some(credentials))
                .pipe(
                  Effect.flatMap((saved) =>
                    saved ? events.connected(channel, true) : Effect.void
                  )
                )
            );

            return channel;
          })
        );

      const add = Effect.fn("ConnectChat.add")(function* add(
        actor: Actor,
        chat: VerifiedChat
      ) {
        const id = yield* newId(ChannelIdSchema).pipe(
          Effect.provideService(Ids, ids)
        );

        const channel = connectChannel(
          {
            ...connectedOf(chat),
            accountId: chat.accountId,
            id,
            platform: chat.platform,
            workspaceId: actor.workspaceId,
          },
          yield* DateTime.now
        );

        const credentials = yield* encryptTokens(tokensOf(chat), id).pipe(
          withCipher
        );

        yield* insertCounted(
          channel,
          credentials,
          events.connected(channel, false)
        );

        return channel;
      });

      // A new chat, unless another tab connected it meanwhile: this one
      // then reconnects it.
      const addOrReconnect = (actor: Actor, chat: VerifiedChat) =>
        add(actor, chat).pipe(
          Effect.catchTag("ChannelAlreadyConnected", () =>
            Effect.gen(function* raced() {
              const other = yield* channels.findByAccount(
                actor.workspaceId,
                chat.platform,
                chat.accountId
              );

              // Removed again since: nothing to reconnect, and the member
              // tries again.
              if (Option.isNone(other)) {
                return yield* new PlatformUnavailable();
              }

              return yield* reconnectTo(other.value, chat);
            })
          )
        );

      const connect = Effect.fn("ConnectChat.connect")(function* connect(
        actor: Actor,
        signIn: ChatSignIn,
        reconnecting: Option.Option<ChannelId>
      ) {
        yield* Effect.fromResult(authorize(actor, "channel:connect"));
        yield* pace.take(actor.workspaceId);

        // The channel to reconnect, which must be the workspace's, of the
        // platform the secret is for.
        const asked = yield* Option.match(reconnecting, {
          onNone: () => Effect.succeed(Option.none<Channel>()),
          onSome: (channelId) =>
            channels
              .findById(actor.workspaceId, channelId)
              .pipe(
                Effect.flatMap((found) =>
                  Option.exists(
                    found,
                    (channel) => channel.platform === signIn.platform
                  )
                    ? Effect.succeed(found)
                    : Effect.fail(new ChannelNotFound({ channelId }))
                )
              ),
        });

        // A new chat needs room in the plan: checked before the platform
        // is given the secret, unless the workspace has a chat there
        // already, which the secret may reconnect.
        const known = (yield* channels.list(actor.workspaceId)).some(
          (channel) => channel.platform === signIn.platform
        );

        if (!known) {
          yield* roomForChannel(actor.workspaceId);
        }

        const chat = yield* verifier.verify(signIn);

        if (Option.isSome(asked)) {
          const channel = asked.value;

          // The secret must reach the channel's own chat again.
          if (channel.accountId !== chat.accountId) {
            return yield* new ReconnectAccountMismatch({
              channelId: channel.id,
            });
          }

          return yield* reconnectTo(channel, chat);
        }

        const existing = yield* channels.findByAccount(
          actor.workspaceId,
          chat.platform,
          chat.accountId
        );

        return Option.isSome(existing)
          ? yield* reconnectTo(existing.value, chat)
          : yield* addOrReconnect(actor, chat);
      });

      return ConnectChat.of({ connect });
    })
  );
}
