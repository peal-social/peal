import { Effect, Layer, Schema } from "effect";

import { SiteCredentials } from "#articles/application/site-credentials.ts";
import type { SiteCredentialFailure } from "#articles/application/site-credentials.ts";
import { articleRefusalCodes } from "#articles/domain/article-refusals.ts";
import { ChannelAccess } from "#channels/application/channel-access.ts";
import type { AccessFailure } from "#channels/application/channel-access.ts";
import { ChannelUnusable } from "#channels/application/channel-unusable.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

const isUnusable = Schema.is(ChannelUnusable);

const isDatabaseError = Schema.is(DatabaseError);

// Disconnected or turned off: the article cannot go out on the channel.
const unusable = ({ reason }: ChannelUnusable) =>
  Effect.fail(
    new BadRequest({
      code:
        reason === "notFound"
          ? articleRefusalCodes.channelDisconnected
          : articleRefusalCodes.channelDisabled,
    })
  );

// The channels context could not read or save the credential: nothing was
// sent, and trying again later is safe.
const databaseDown = (failure: DatabaseError) =>
  Effect.logWarning("Could not read a channel's token", failure).pipe(
    Effect.andThen(Effect.fail(new PlatformUnavailable()))
  );

// What the channels context's refusal means for an article; failures of
// the call itself pass through.
const credentialFailure = <E>(
  failure: AccessFailure | E
): Effect.Effect<never, SiteCredentialFailure | E> => {
  if (isUnusable(failure)) {
    return unusable(failure);
  }

  return isDatabaseError(failure)
    ? databaseDown(failure)
    : Effect.fail(failure);
};

/** A website's credential, as the channels context hands it out. */
export const ChannelAccessSiteCredentials = Layer.effect(
  SiteCredentials,
  Effect.gen(function* ChannelAccessSiteCredentials() {
    const access = yield* ChannelAccess;

    return SiteCredentials.of({
      withToken: <A, E, R>(
        channelId: ChannelId,
        use: (token: SiteToken) => Effect.Effect<A, E | TokenRejected, R>
      ): Effect.Effect<
        A,
        SiteCredentialFailure | Exclude<E, TokenRejected>,
        R
      > =>
        access
          .withSiteToken(channelId, ({ accessToken, accountId, platform }) =>
            use({ credential: accessToken, platform, root: accountId })
          )
          .pipe(Effect.catch(credentialFailure<Exclude<E, TokenRejected>>)),
    });
  })
);
