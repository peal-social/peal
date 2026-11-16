import { Effect, Layer } from "effect";
import { Mac, SecureRandom } from "effect/crypto";

import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";

import { ChannelPlatforms } from "./channel-platform-settings.ts";
import { metaMessageDepartures } from "./meta/meta-message-departures.ts";

/**
 * What a disconnected channel set up on its platform, undone as the
 * settings say: Meta's message events, where PEAL_INBOX_MESSAGES names
 * Facebook or Instagram. Needs ChannelPlatforms, ChannelDirectory,
 * EngagementRecords, Mac and the public HTTP client's services.
 */
export const ChannelDeparturesLive = Layer.unwrap(
  Effect.gen(function* ChannelDeparturesLive() {
    const settings = yield* ChannelPlatforms;

    return metaMessageDepartures({
      hosts: settings.metaHosts,
      http: yield* publicHttpClient,
      mainApp: settings.meta,
      messages: settings.messages,
    });
  })
).pipe(
  Layer.provide(
    Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
  )
);
