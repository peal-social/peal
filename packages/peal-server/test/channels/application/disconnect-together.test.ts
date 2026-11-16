import { assert, layer } from "@effect/vitest";
import { Context, Deferred, Effect, Layer, Option, Redacted } from "effect";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import { ChannelEvents } from "#channels/application/channel-events.ts";
import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { encryptTokens } from "#channels/application/channel-tokens.ts";
import { DisconnectChannel } from "#channels/application/disconnect-channel.ts";
import { PlatformAuthorizers } from "#channels/application/platform-authorizer.ts";
import type { PlatformAuthorizer } from "#channels/application/platform-authorizer.ts";
import { tokenPolicies } from "#channels/domain/token-policy.ts";
import { DrizzleChannelRepository } from "#channels/infrastructure/drizzle-channel-repository.ts";
import { authorizersOf } from "#test/channels/connect-support.ts";
import {
  actorIn,
  DatabaseTest,
  freshChannel,
  freshWorkspace,
  TokenCipherTest,
} from "#test/channels/support.ts";

// A disconnect undoes what the channel set up on its platform (Meta's
// message events) while the platform revokes its tokens, side by side, so
// the member waits ten seconds at most.

// A platform whose sign-in revokes tokens, telling when it is asked to.
class RevokeStarted extends Context.Service<
  RevokeStarted,
  Deferred.Deferred<true>
>()("test/RevokeStarted") {}

const revoking = Layer.effect(
  PlatformAuthorizers,
  Effect.gen(function* revoking() {
    const started = yield* RevokeStarted;

    const authorizer: PlatformAuthorizer = {
      begin: () => Effect.die("not signed in here"),
      complete: () => Effect.die("not signed in here"),
      platform: "mastodon",
      policy: tokenPolicies.mastodon,
      refresh: () => Effect.die("not renewed here"),
      revoke: () => Deferred.succeed(started, true).pipe(Effect.asVoid),
    };

    return authorizersOf(authorizer);
  })
);

// A departure that ends only once the revoke began: a disconnect that ran
// them one after the other would never end.
const WaitingDepartures = Layer.effect(
  ChannelDepartures,
  Effect.gen(function* WaitingDepartures() {
    const started = yield* RevokeStarted;

    return ChannelDepartures.of({ departed: () => Deferred.await(started) });
  })
);

const TogetherTest = DisconnectChannel.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      DrizzleChannelRepository,
      ChannelEvents.none,
      TokenCipherTest,
      revoking,
      WaitingDepartures
    )
  ),
  Layer.provideMerge(Layer.effect(RevokeStarted, Deferred.make<true>())),
  Layer.provideMerge(DatabaseTest)
);

layer(TogetherTest)("disconnecting a channel, within ten seconds", (it) => {
  it.effect(
    "undoes what it set up on its platform while the platform revokes its tokens",
    () =>
      Effect.gen(function* together() {
        const workspaceId = yield* freshWorkspace;
        const channel = yield* freshChannel(workspaceId);

        const credentials = yield* encryptTokens(
          {
            accessToken: Redacted.make("synthetic-access-token"),
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

        yield* DisconnectChannel.use((useCase) =>
          useCase.disconnect(
            actorIn(workspaceId, ["channel:read", "channel:disconnect"]),
            channel.id
          )
        );

        assert.isTrue(yield* Deferred.isDone(yield* RevokeStarted));
      }),
    { timeout: 20_000 }
  );
});
