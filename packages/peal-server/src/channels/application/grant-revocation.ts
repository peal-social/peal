import { Duration, Effect, Option } from "effect";

import type { Channel } from "#channels/domain/channel.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import type { ChannelPlatform } from "#shared/domain/platform.ts";

import { ChannelRepository } from "./channel-repository.ts";
import { PlatformAuthorizers } from "./platform-authorizer.ts";
import type { StoredTokens } from "./platform-authorizer.ts";

/** The longest a channel's going waits on its platform to forget the grant. */
export const revokeTimeout = Duration.seconds(10);

/**
 * The platforms whose one grant reaches several channels Peal cannot tell
 * apart from others: Google revokes a user's whole grant to Peal's client
 * whichever of its tokens is revoked, and a sign-in gives every location
 * of a Business Profile, or several YouTube channels, the same tokens,
 * while a channel keeps no id of the Google user behind it. Revoking for
 * one channel would end the others, in any workspace: their grants stay,
 * until the user removes Peal in their Google account.
 */
export const grantsSpanningAccounts: ReadonlySet<ChannelPlatform> =
  new Set<ChannelPlatform>(["googleBusiness", "youtube"]);

// A platform that did not revoke a channel's tokens, or a grant whose
// sharing could not be read.
const notRevoked = (cause: { readonly _tag: string }) =>
  Effect.logWarning(
    "The platform did not revoke a departed channel's tokens",
    cause
  );

/**
 * Tells the channel's platform, when it takes it (TikTok), that
 * the tokens the channel held are no longer wanted: once a member
 * disconnected it, or before its workspace's erasure deletes it. Unless
 * another channel, in any workspace, still connects the same account, as
 * they share its grant; `leaving` are the channels that go with it, which
 * share nothing any more. A courtesy to the account's owner: it waits
 * `revokeTimeout` at most, never fails, and logs what went wrong, so a
 * channel's going never waits on its platform nor stops for it.
 */
export const revokeUnsharedGrant = Effect.fn("Channels.revokeUnsharedGrant")(
  function* revokeUnsharedGrant(
    channel: Channel,
    tokens: StoredTokens,
    leaving: readonly ChannelId[] = []
  ) {
    if (grantsSpanningAccounts.has(channel.platform)) {
      return;
    }

    const revoking = (yield* PlatformAuthorizers)
      .for(channel.platform, channel.connection)
      .pipe(Option.flatMapNullishOr((authorizer) => authorizer.revoke));

    if (Option.isNone(revoking)) {
      return;
    }

    const repository = yield* ChannelRepository;

    if (
      yield* repository.accountInUse(
        channel.platform,
        channel.accountId,
        leaving
      )
    ) {
      return;
    }

    yield* revoking.value(tokens);
  },
  Effect.timeout(revokeTimeout),
  (revoked, channel) =>
    revoked.pipe(
      Effect.catch(notRevoked),
      Effect.annotateLogs({ channelId: channel.id, platform: channel.platform })
    )
);
