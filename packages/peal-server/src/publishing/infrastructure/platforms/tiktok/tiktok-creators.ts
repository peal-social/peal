import { Effect, Layer, Option } from "effect";
import { FetchHttpClient } from "effect/http";

import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import { TikTokCreators } from "#publishing/application/tiktok-creators.ts";
import { readRefusedCode } from "#publishing/domain/own-refusals.ts";
import { hostNotAllowedCode } from "#publishing/infrastructure/platforms/platform-exchange.ts";
import type { BadRequest } from "#shared/domain/bad-request.ts";
import { storableLine } from "#shared/domain/platform-text.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { tiktokHosts } from "#shared/infrastructure/platforms/tiktok-api.ts";

import { queryCreator } from "./tiktok-creator-info.ts";
import { tiktokMediaUrlConfig } from "./tiktok-settings.ts";

// The longest code a refusal is logged with: TikTok's are identifiers.
const codeLength = 64;

// TikTok answered and refused to tell the creator's settings (an app it has
// not audited, a request it could not read), or Peal's outbound guard
// refused its host: the read has no answer, and nothing of the channel is
// wrong. Unlike an outage it may come back the same each time, which
// `readRefusedCode` says. Logged by its code, never TikTok's message, which
// may quote what was sent.
const refusedRead = ({ code }: BadRequest) =>
  Effect.logWarning(
    code === hostNotAllowedCode
      ? "Peal's outbound guard refused TikTok's host"
      : "TikTok refused to read a creator's settings"
  ).pipe(
    Effect.annotateLogs({ code: storableLine(code, codeLength) }),
    Effect.andThen(
      Effect.fail(new PlatformUnavailable({ code: readRefusedCode }))
    )
  );

/**
 * TikTokCreators on TikTok's creator info, with the channel's token from
 * PlatformCredentials, renewed once if TikTok refuses it. `pullFrom` is the
 * verified prefix photos are pulled from, if the server has one. A
 * `BadRequest` is the channels context's alone (the channel disconnected or
 * turned off): TikTok's refusals of the read are `PlatformUnavailable`
 * with `readRefusedCode`.
 */
export const tiktokCreatorsWith = (settings: {
  readonly apiUrl: URL;
  readonly pullFrom: Option.Option<URL>;
}) =>
  Layer.effect(
    TikTokCreators,
    Effect.gen(function* TikTokCreatorsLive() {
      const credentials = yield* PlatformCredentials;
      const api = yield* publicHttpClient;
      const readCreator = queryCreator({ api, apiUrl: settings.apiUrl });

      return TikTokCreators.of({
        read: (channelId) =>
          credentials.withToken(channelId, ({ accessToken }) =>
            readCreator(accessToken).pipe(
              Effect.catchTag("BadRequest", refusedRead)
            )
          ),
        takesPhotos: Option.isSome(settings.pullFrom),
      });
    })
  );

/**
 * TikTok's creators as production reaches them, with the verified prefix
 * read when the server starts. Needs PlatformCredentials and Dns.
 */
export const TikTokCreatorsLive = Layer.unwrap(
  tiktokMediaUrlConfig.pipe(
    Effect.map((pullFrom) =>
      tiktokCreatorsWith({ apiUrl: tiktokHosts.api, pullFrom })
    )
  )
).pipe(
  Layer.provide(OutboundGuard.layer),
  Layer.provide(FetchHttpClient.layer)
);
