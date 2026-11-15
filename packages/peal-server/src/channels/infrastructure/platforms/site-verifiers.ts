import { Effect, Layer } from "effect";

import { SiteVerifier } from "#channels/application/site-verifier.ts";
import type { SiteKeySignIn } from "#channels/application/site-verifier.ts";
import type { DevToHosts } from "#shared/infrastructure/platforms/devto-api.ts";

import { devtoVerifyKey } from "./devto/devto-key-verifier.ts";
import { wordpressSiteVerify } from "./wordpress/wordpress-site-verifier.ts";

/** Where the publishing platforms' APIs are. */
export interface SiteHosts {
  readonly devto: DevToHosts;
}

/**
 * SiteVerifier for every kind of website: a WordPress site by its
 * address and an application password, a publishing platform by the
 * member's key, each on its own API, through the public HTTP client and
 * the outbound guard.
 */
export const siteVerifiersLive = (hosts: SiteHosts) =>
  Layer.effect(
    SiteVerifier,
    Effect.gen(function* SiteVerifiersLive() {
      const verify = yield* wordpressSiteVerify;
      const devto = yield* devtoVerifyKey(hosts.devto);

      const byPlatform = { devto } satisfies Record<
        SiteKeySignIn["platform"],
        typeof devto
      >;

      return SiteVerifier.of({
        verify,
        verifyKey: (signIn) => byPlatform[signIn.platform](signIn),
      });
    })
  );
