import { Effect, Layer } from "effect";

import { ChannelDirectory } from "#channels/application/channel-directory.ts";
import { MessageChannelsOfAccount } from "#engagement/application/ports/message-channels-of-account.ts";

/**
 * The channels of an account, from the channels context's directory: ids
 * alone, never a token, a handle or a name.
 */
export const ChannelsMessageAccounts = Layer.effect(
  MessageChannelsOfAccount,
  Effect.gen(function* ChannelsMessageAccounts() {
    const directory = yield* ChannelDirectory;

    return MessageChannelsOfAccount.of({
      channelsOf: (platform, accountId) =>
        directory.withAccount(platform, accountId).pipe(
          Effect.map((listed) =>
            listed.map(({ channelId, connection, workspaceId }) => ({
              channelId,
              connection,
              workspaceId,
            }))
          )
        ),
    });
  })
);
