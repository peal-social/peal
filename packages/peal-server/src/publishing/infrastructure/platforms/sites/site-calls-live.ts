import { Effect, Layer } from "effect";

import { SiteCalls } from "#publishing/application/site-calls.ts";
import type { SiteAdapter } from "#publishing/application/site-calls.ts";
import { devtoSiteAdapter } from "#publishing/infrastructure/platforms/devto/devto-articles.ts";
import { hashnodeSiteAdapter } from "#publishing/infrastructure/platforms/hashnode/hashnode-articles.ts";
import { wordpressSiteAdapter } from "#publishing/infrastructure/platforms/wordpress/wordpress-articles.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import { devtoHosts } from "#shared/infrastructure/platforms/devto-api.ts";
import type { DevToHosts } from "#shared/infrastructure/platforms/devto-api.ts";
import { hashnodeHosts } from "#shared/infrastructure/platforms/hashnode-api.ts";
import type { HashnodeHosts } from "#shared/infrastructure/platforms/hashnode-api.ts";
import { wordpressComHosts } from "#shared/infrastructure/platforms/wordpress-api.ts";
import type { WordPressComHosts } from "#shared/infrastructure/platforms/wordpress-api.ts";

/** Where the websites' APIs are: DEV's, Hashnode's and WordPress.com's. */
export interface SiteHosts {
  readonly devto: DevToHosts;
  readonly hashnode: HashnodeHosts;
  readonly wordpressCom: WordPressComHosts;
}

/** The websites' own hosts. */
export const siteHosts: SiteHosts = {
  devto: devtoHosts,
  hashnode: hashnodeHosts,
  wordpressCom: wordpressComHosts,
};

/**
 * The websites' calls (SiteCalls), each made by the adapter of the
 * platform its credential names: WordPress's serves WordPress sites and
 * WordPress.com's, DEV's and Hashnode's their own. Needs
 * MediaForPublishing, an HttpClient and the OutboundGuard.
 */
export const siteCallsWith = (hosts: SiteHosts) =>
  Layer.effect(
    SiteCalls,
    Effect.gen(function* SiteCallsLive() {
      const wordpress = yield* wordpressSiteAdapter(hosts.wordpressCom);

      const adapters: Readonly<Record<SitePlatform, SiteAdapter>> = {
        devto: yield* devtoSiteAdapter(hosts.devto),
        hashnode: yield* hashnodeSiteAdapter(hosts.hashnode),
        wordpress,
        wordpressCom: wordpress,
      };

      return SiteCalls.of({
        find: (request, article, journal, token) =>
          adapters[token.platform].find(request, article, journal, token),
        publish: (article, journal, token) =>
          adapters[token.platform].publish(article, journal, token),
        remove: (platformPostId, token) =>
          adapters[token.platform].remove(platformPostId, token),
        resume: (request, article, journal, token) =>
          adapters[token.platform].resume(request, article, journal, token),
        update: (article, journal, platformPostId, token, standing) =>
          adapters[token.platform].update(
            article,
            journal,
            platformPostId,
            token,
            standing
          ),
      });
    })
  );
