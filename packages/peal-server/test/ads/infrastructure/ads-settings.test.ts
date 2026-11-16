import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { FetchHttpClient } from "effect/http";

import { AdNetworks } from "#ads/application/ports/ad-network.ts";
import { AdNetworksLive } from "#ads/infrastructure/ad-networks-live.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";

// What a server offers of ads, from the settings it starts with.

const metaApp = {
  META_APP_ID: "1234567890",
  META_APP_SECRET: "synthetic-meta-secret",
};

const googleClient = {
  GOOGLE_ADS_CLIENT_ID: "synthetic-client.apps.googleusercontent.com",
  GOOGLE_ADS_CLIENT_SECRET: "synthetic-google-ads-secret",
};

const started = (env: Readonly<Record<string, string>>) =>
  Effect.gen(function* offered() {
    return yield* AdNetworks;
  }).pipe(
    Effect.provide(
      AdNetworksLive.pipe(
        Layer.provide(Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard)),
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
      )
    ),
    Effect.map((networks) => ({
      available: networks.available,
      clients: networks.available.map((network) =>
        networks.for(network).pipe((client) => client._tag)
      ),
      mode: networks.mode,
    }))
  );

const refusal = (env: Readonly<Record<string, string>>) =>
  started(env).pipe(
    Effect.exit,
    Effect.map((exit) =>
      Exit.isFailure(exit)
        ? exit.cause.reasons.map((reason) =>
            reason._tag === "Fail" && "reason" in reason.error
              ? reason.error.reason
              : reason._tag
          )
        : ["started"]
    )
  );

describe("the ad networks a server offers", () => {
  it.effect("none while ads are off, whatever else is set", () =>
    Effect.gen(function* off() {
      assert.deepStrictEqual(yield* started({ PEAL_ADS_NETWORKS: "tiktok" }), {
        available: [],
        clients: [],
        mode: "off",
      });
    })
  );

  it.effect(
    "Meta alone when PEAL_ADS_NETWORKS is unset or blank, as before",
    () =>
      Effect.gen(function* meta() {
        for (const env of [
          { ...metaApp, PEAL_ADS: "read" },
          { ...metaApp, PEAL_ADS: "spend", PEAL_ADS_NETWORKS: " " },
          { ...metaApp, ...googleClient, PEAL_ADS: "read" },
        ]) {
          assert.deepStrictEqual((yield* started(env)).available, ["meta"]);
        }
      })
  );

  it.effect("Google Ads where it is named, with its client", () =>
    Effect.gen(function* google() {
      assert.deepStrictEqual(
        yield* started({
          ...metaApp,
          ...googleClient,
          PEAL_ADS: "read",
          PEAL_ADS_NETWORKS: "google, meta",
        }),
        {
          available: ["meta", "google"],
          clients: ["Some", "Some"],
          mode: "read",
        }
      );

      // Google alone needs no Meta app.
      assert.deepStrictEqual(
        (yield* started({
          ...googleClient,
          PEAL_ADS: "read",
          PEAL_ADS_NETWORKS: "google",
        })).available,
        ["google"]
      );
    })
  );

  it.effect("stops the server on settings it cannot use", () =>
    Effect.gen(function* stopped() {
      assert.deepStrictEqual(
        yield* refusal({
          ...metaApp,
          PEAL_ADS: "read",
          PEAL_ADS_NETWORKS: "meta,tiktok",
        }),
        ["PEAL_ADS_NETWORKS lists meta and google, separated by commas"]
      );
      assert.deepStrictEqual(
        yield* refusal({ PEAL_ADS: "read", PEAL_ADS_NETWORKS: "google" }),
        [
          "PEAL_ADS_NETWORKS names google: it needs GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET",
        ]
      );
      assert.deepStrictEqual(
        yield* refusal({
          GOOGLE_ADS_CLIENT_ID: googleClient.GOOGLE_ADS_CLIENT_ID,
          PEAL_ADS: "read",
          PEAL_ADS_NETWORKS: "google",
        }),
        ["GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET go together"]
      );
      assert.deepStrictEqual(
        yield* refusal({
          ...googleClient,
          PEAL_ADS: "read",
          PEAL_ADS_NETWORKS: "meta,google",
        }),
        ["PEAL_ADS needs META_APP_ID and META_APP_SECRET"]
      );
      assert.deepStrictEqual(
        yield* refusal({
          ...googleClient,
          PEAL_ADS: "spend",
          PEAL_ADS_NETWORKS: "google",
        }),
        [
          "PEAL_ADS=spend needs meta in PEAL_ADS_NETWORKS: Google Ads is read only",
        ]
      );
    })
  );
});
