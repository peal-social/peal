import { Effect, Option, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import { SiteRefused } from "#channels/application/site-refused.ts";
import type {
  SiteKeySignIn,
  VerifiedSite,
} from "#channels/application/site-verifier.ts";
import { AvatarUrlSchema } from "#channels/domain/avatar-url.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  devtoErrorOf,
  devtoUrl,
  withDevToKey,
} from "#shared/infrastructure/platforms/devto-api.ts";
import type { DevToHosts } from "#shared/infrastructure/platforms/devto-api.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";

// The member DEV says the key is theirs (`GET /api/users/me`).
const MeSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.optionalKey(Schema.NullOr(Schema.String)),
  profile_image: Schema.optionalKey(Schema.NullOr(Schema.String)),
  username: Schema.String,
});

const decodeAvatar = Schema.decodeUnknownOption(AvatarUrlSchema);

/**
 * How `SiteVerifier` checks a DEV key: the account it opens, read with
 * Forem's API v1. A key opens all its account does, publishing included,
 * so no right is asked. Only DEV's own 401 refuses the key; anything a
 * server on the way says, a limit or a failure, is DEV unavailable.
 */
export const devtoVerifyKey = Effect.fnUntraced(function* devtoVerifyKey(
  hosts: DevToHosts
) {
  const http = yield* publicHttpClient;

  return Effect.fn("DevToKeyVerifier.verify")(function* verify(
    signIn: SiteKeySignIn
  ) {
    const response = yield* http
      .execute(
        HttpClientRequest.get(devtoUrl(hosts, "/api/users/me")).pipe(
          withDevToKey(signIn.apiKey)
        )
      )
      .pipe(Effect.mapError(() => new PlatformUnavailable()));

    if (response.status === 401) {
      const own = yield* devtoErrorOf(response);

      return yield* Option.isSome(own)
        ? new SiteRefused({ reason: "credentialsRefused" })
        : new PlatformUnavailable();
    }

    if (response.status !== 200) {
      return yield* new PlatformUnavailable();
    }

    const me = yield* HttpClientResponse.schemaBodyJson(MeSchema)(
      response
    ).pipe(Effect.mapError(() => new PlatformUnavailable()));

    const site: VerifiedSite = {
      accountId: String(me.id),
      avatarUrl: Option.fromNullishOr(me.profile_image).pipe(
        Option.flatMap(decodeAvatar)
      ),
      displayName: Option.fromNullishOr(me.name).pipe(
        Option.filter((name) => name.trim() !== "")
      ),
      handle: `dev.to/${me.username}`,
      scopes: [],
    };

    return site;
  });
});
