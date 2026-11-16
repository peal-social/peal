import { Effect, Layer, Redacted } from "effect";
import { FetchHttpClient } from "effect/http";

import { googleAdsClient } from "#ads/infrastructure/google/google-ads-client.ts";
import { googleAdsHttpClient } from "#ads/infrastructure/google/google-ads-http.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

import {
  fakeGoogleAdsApi,
  googleAdsSettings,
  googleRefreshToken,
} from "./fakes/fake-google-ads-api.ts";
import type { FakeGoogleAdsOptions } from "./fakes/fake-google-ads-api.ts";

const HttpTest = Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard);

/** The refresh token the fake accepts, as a grant holds it. */
export const refreshToken = Redacted.make(googleRefreshToken);

/** The Google Ads adapter against the fake on loopback. */
export const googleAgainstFake = Effect.fn("test.googleAgainstFake")(
  function* googleAgainstFake(options: FakeGoogleAdsOptions = {}) {
    const api = yield* fakeGoogleAdsApi(options);

    const client = googleAdsClient({
      endpoints: api.endpoints,
      http: yield* googleAdsHttpClient.pipe(Effect.provide(HttpTest)),
      publicUrl: "https://peal.example",
      settings: googleAdsSettings,
    });

    return { api, client };
  }
);
