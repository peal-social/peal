import { Context, Effect, Layer, Option, Schema } from "effect";

import type { Channel } from "#channels/domain/channel.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";

import type { ChannelCredentials } from "./channel-credentials.ts";
import { ChannelDepartures } from "./channel-departures.ts";
import { ChannelEvents } from "./channel-events.ts";
import { ChannelNotFound } from "./channel-not-found.ts";
import { ChannelRepository } from "./channel-repository.ts";
import { decryptTokens } from "./channel-tokens.ts";
import { revokeUnsharedGrant } from "./grant-revocation.ts";
import { PlatformAuthorizers } from "./platform-authorizer.ts";
import { TokenCipher } from "./token-cipher.ts";

const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);

/**
 * Disconnects a channel of the actor's workspace: the channel and its tokens
 * are deleted. Needs channel:disconnect. An id that names no channel of the
 * workspace, including one that is not a channel id at all, is
 * ChannelNotFound.
 *
 * Once it is gone, a platform that takes it (TikTok, Google) is asked to
 * revoke the tokens, unless another channel, in any workspace, still
 * connects the same account: they share its grant. Revoking is a courtesy
 * to the account's owner: it waits 10 seconds at most, a failure is logged,
 * and the channel stays disconnected. Before that, what the channel set up
 * on its platform for Peal is undone with the tokens it held
 * (ChannelDepartures: Meta's message events), best effort too.
 */
export class DisconnectChannel extends Context.Service<
  DisconnectChannel,
  {
    readonly disconnect: (
      actor: Actor,
      channelId: string
    ) => Effect.Effect<
      void,
      ChannelNotFound | DatabaseError | MissingPermission
    >;
  }
>()("peal-server/channels/application/DisconnectChannel") {
  static readonly layer = Layer.effect(
    DisconnectChannel,
    Effect.gen(function* DisconnectChannelLive() {
      const channels = yield* ChannelRepository;
      const authorizers = yield* PlatformAuthorizers;
      const cipher = yield* TokenCipher;
      const events = yield* ChannelEvents;
      const departures = yield* ChannelDepartures;

      // Deletes the channel and tells of it in one transaction, the
      // workspace's additions': both happen, or neither.
      const remove = (channel: Channel) =>
        channels.addingTo(
          channel.workspaceId,
          channels
            .remove(channel.workspaceId, channel.id)
            .pipe(
              Effect.tap((removed) =>
                removed ? events.disconnected(channel, "member") : Effect.void
              )
            )
        );

      const disconnect = Effect.fn("DisconnectChannel.disconnect")(
        function* disconnect(actor: Actor, channelId: string) {
          yield* Effect.fromResult(authorize(actor, "channel:disconnect"));

          const id = decodeChannelId(channelId);

          const channel = Option.isSome(id)
            ? yield* channels.findById(actor.workspaceId, id.value)
            : Option.none<Channel>();

          const credentials = Option.isSome(channel)
            ? yield* channels.credentials(channel.value.id)
            : Option.none<ChannelCredentials>();

          const removed = Option.isSome(channel)
            ? yield* remove(channel.value)
            : false;

          if (!removed || Option.isNone(channel)) {
            return yield* new ChannelNotFound({ channelId });
          }

          if (Option.isNone(credentials)) {
            return yield* Effect.void;
          }

          // What the channel set up on its platform is undone while the
          // platform revokes its tokens, side by side, so the member waits
          // ten seconds at most. Neither fails: what is left is the
          // platform's to forget.
          return yield* decryptTokens(credentials.value, channel.value.id).pipe(
            Effect.provideService(TokenCipher, cipher),
            Effect.flatMap((tokens) =>
              Effect.all(
                [
                  departures.departed(channel.value, tokens),
                  revokeUnsharedGrant(channel.value, tokens).pipe(
                    Effect.provideService(ChannelRepository, channels),
                    Effect.provideService(PlatformAuthorizers, authorizers)
                  ),
                ],
                { concurrency: 2, discard: true }
              )
            ),
            Effect.catch(() =>
              Effect.logWarning(
                "Could not read a disconnected channel's tokens"
              ).pipe(Effect.annotateLogs({ channelId: channel.value.id }))
            )
          );
        }
      );

      return DisconnectChannel.of({ disconnect });
    })
  );
}
