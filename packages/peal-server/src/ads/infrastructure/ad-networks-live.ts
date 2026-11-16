import { Config, Effect, Layer, Option, Schema } from "effect";
import { Mac, SecureRandom } from "effect/crypto";

import { AdNetworks } from "#ads/application/ports/ad-network.ts";
import type { AdNetworkClient } from "#ads/application/ports/ad-network.ts";
import { AdNetworkSchema } from "#ads/domain/ad-network.ts";
import type { AdNetwork } from "#ads/domain/ad-network.ts";
import { AdsModeSchema } from "#ads/domain/ads-mode.ts";
import type { AdsMode } from "#ads/domain/ads-mode.ts";
import { publicUrlConfig } from "#shared/infrastructure/environment.ts";
import { metaAppConfig } from "#shared/infrastructure/platforms/meta-apps.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";

import { googleAdsClient } from "./google/google-ads-client.ts";
import {
  googleAdsEndpoints,
  googleAdsHttpClient,
} from "./google/google-ads-http.ts";
import { googleAdsClientConfig } from "./google/google-ads-settings.ts";
import { InvalidAdsSettings } from "./invalid-ads-settings.ts";
import { metaAdsClient } from "./meta/meta-ads-client.ts";

const decodeMode = Schema.decodeUnknownOption(AdsModeSchema);
const decodeNetwork = Schema.decodeUnknownOption(AdNetworkSchema);

/**
 * What the operator set of ads (`PEAL_ADS`): `off` when unset or blank, so
 * a server offers ads only once its operator says so. Anything else than
 * `off`, `read` or `spend` stops the server.
 */
export const adsModeConfig = Effect.gen(function* adsModeConfig() {
  const written = yield* Config.option(Config.String("PEAL_ADS"));

  const value = written.pipe(
    Option.map((text) => text.trim()),
    Option.filter((text) => text !== "")
  );

  if (Option.isNone(value)) {
    return "off" satisfies AdsMode;
  }

  return yield* Option.match(decodeMode(value.value), {
    onNone: () =>
      Effect.fail(
        new InvalidAdsSettings({ reason: "PEAL_ADS is off, read or spend" })
      ),
    onSome: (mode) => Effect.succeed(mode),
  });
});

/**
 * The networks the operator offers (`PEAL_ADS_NETWORKS`, names separated
 * by commas): `meta` when unset or blank, so a server behaves as before
 * the setting existed, and Google Ads only once named. Another name stops
 * the server. They come in the order `AdNetworkSchema` lists them.
 */
export const adsNetworksConfig = Effect.gen(function* adsNetworksConfig() {
  const written = yield* Config.option(Config.String("PEAL_ADS_NETWORKS"));

  const names = Option.getOrElse(written, () => "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");

  if (names.length === 0) {
    return ["meta"] satisfies readonly AdNetwork[];
  }

  const named = new Set<AdNetwork>();

  for (const name of names) {
    const network = decodeNetwork(name);

    if (Option.isNone(network)) {
      return yield* new InvalidAdsSettings({
        reason: "PEAL_ADS_NETWORKS lists meta and google, separated by commas",
      });
    }

    named.add(network.value);
  }

  return AdNetworkSchema.literals.filter((network) => named.has(network));
});

/** The networks' clients, as a server in `mode` offers them. */
export const adNetworksOf = (
  mode: AdsMode,
  clients: readonly AdNetworkClient[]
) =>
  AdNetworks.of({
    available: mode === "off" ? [] : clients.map(({ network }) => network),
    for: (network: AdNetwork) =>
      mode === "off"
        ? Option.none()
        : Option.fromUndefinedOr(
            clients.find((client) => client.network === network)
          ),
    mode,
  });

// Meta's client, on Meta's main app.
const metaNetwork = (mode: AdsMode, publicUrl: string) =>
  Effect.gen(function* buildingMeta() {
    const app = yield* metaAppConfig;

    if (Option.isNone(app)) {
      return yield* new InvalidAdsSettings({
        reason: "PEAL_ADS needs META_APP_ID and META_APP_SECRET",
      });
    }

    return yield* metaAdsClient({
      app: app.value,
      hosts: metaHosts,
      http: yield* publicHttpClient,
      mode,
      publicUrl,
    });
  });

// Google Ads' client, read only, on the operator's OAuth client.
const googleNetwork = (publicUrl: string) =>
  Effect.gen(function* buildingGoogle() {
    const settings = yield* googleAdsClientConfig;

    if (Option.isNone(settings)) {
      return yield* new InvalidAdsSettings({
        reason:
          "PEAL_ADS_NETWORKS names google: it needs GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET",
      });
    }

    return googleAdsClient({
      endpoints: googleAdsEndpoints,
      http: yield* googleAdsHttpClient,
      publicUrl,
      settings: settings.value,
    });
  });

/**
 * The ad networks this server reaches, read from its settings when it
 * starts: none while `PEAL_ADS` is off, and then nothing else is read.
 * Otherwise those `PEAL_ADS_NETWORKS` names, Meta's alone by default.
 * Meta's ads run on Meta's main app (`META_APP_ID`, `META_APP_SECRET`),
 * the one Facebook Pages connect with, so its data deletion and
 * deauthorization callbacks cover the ads sign-ins too; Google Ads, read
 * only, on its own OAuth client (`GOOGLE_ADS_CLIENT_ID`,
 * `GOOGLE_ADS_CLIENT_SECRET`). A network named without its app or client
 * stops the server, as does `spend` without Meta, the one network Peal
 * spends on. Needs an HttpClient and the OutboundGuard.
 */
export const AdNetworksLive = Layer.effect(
  AdNetworks,
  Effect.gen(function* AdNetworksLive() {
    const mode = yield* adsModeConfig;

    if (mode === "off") {
      return adNetworksOf(mode, []);
    }

    const networks = yield* adsNetworksConfig;

    if (mode === "spend" && !networks.includes("meta")) {
      return yield* new InvalidAdsSettings({
        reason:
          "PEAL_ADS=spend needs meta in PEAL_ADS_NETWORKS: Google Ads is read only",
      });
    }

    const publicUrl = yield* publicUrlConfig;

    // Each network's client, which a network added does not compile
    // without.
    const clientOf = {
      google: googleNetwork(publicUrl),
      meta: metaNetwork(mode, publicUrl),
    } satisfies Record<
      AdNetwork,
      Effect.Effect<AdNetworkClient, unknown, unknown>
    >;

    const clients = yield* Effect.all(
      networks.map((network) => clientOf[network])
    );

    return adNetworksOf(mode, clients);
  })
).pipe(
  Layer.provide(
    Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
  )
);
