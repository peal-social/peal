import { Context, Effect, Layer } from "effect";

import type { Channel } from "#channels/domain/channel.ts";

import type { StoredTokens } from "./platform-authorizer.ts";

/**
 * What a channel disconnected by a member set up on its platform for
 * Peal, undone with the tokens it held once it is gone: Meta's
 * subscription to its account's message events, while no other channel of
 * Peal's reads them. Best effort, after the channel's deletion committed:
 * it never fails, and logs a failure by the channel's id.
 */
export class ChannelDepartures extends Context.Service<
  ChannelDepartures,
  {
    readonly departed: (
      channel: Channel,
      tokens: StoredTokens
    ) => Effect.Effect<void>;
  }
>()("peal-server/channels/application/ChannelDepartures") {
  /** Nothing to undo: for servers and tests without such platforms. */
  static readonly none = Layer.succeed(
    ChannelDepartures,
    ChannelDepartures.of({ departed: () => Effect.void })
  );
}
