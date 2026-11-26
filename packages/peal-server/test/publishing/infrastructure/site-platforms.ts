import { Effect, Layer, Option, Redacted } from "effect";
import { Cipher, Digest, Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import { LinkShortener } from "#publishing/application/link-shortener.ts";
import { LivePostClients } from "#publishing/application/live-post-clients.ts";
import { PostMeter } from "#publishing/application/post-meter.ts";
import { RecordedArticles } from "#publishing/application/recorded-articles.ts";
import { RoutedPlatformPublisher } from "#publishing/application/routed-platform-publisher.ts";
import { SiteCalls } from "#publishing/application/site-calls.ts";
import { DrizzlePlatformQuota } from "#publishing/infrastructure/drizzle-platform-quota.ts";
import { DrizzlePublicationJournal } from "#publishing/infrastructure/drizzle-publication-journal.ts";
import { DrizzlePublicationProgress } from "#publishing/infrastructure/drizzle-publication-progress.ts";
import { DrizzleRecordedPosts } from "#publishing/infrastructure/drizzle-recorded-posts.ts";
import { DrizzleSiteFiles } from "#publishing/infrastructure/drizzle-site-files.ts";
import { DrizzleUploadSessions } from "#publishing/infrastructure/drizzle-upload-sessions.ts";
import { platformClientsWith } from "#publishing/infrastructure/platforms/platform-clients-live.ts";
import { siteCallsWith } from "#publishing/infrastructure/platforms/sites/site-calls-live.ts";
import { withSiteClients } from "#publishing/infrastructure/platforms/sites/site-client.ts";
import { siteLivePost } from "#publishing/infrastructure/platforms/sites/site-live-post.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  credentialsOf,
  mediaOf,
  testTiming,
} from "#test/publishing/platforms/support.ts";

// A website as production reaches it through the channel gates, its
// site on a loopback fake: the routed publisher with the site client and
// the adapters, and the live-post clients that take a post off it.

/** The site a server's channels are on. */
export interface SiteUnderTest {
  /** DEV's API, for a DEV site. */
  readonly api?: string;
  readonly credential: string;
  readonly platform: SitePlatform;
  /** The API's root the channel keeps (WordPress), or its account. */
  readonly root: string;
}

const elsewhere = new URL("http://127.0.0.1:9");

const callsOn = (site: SiteUnderTest) =>
  siteCallsWith({
    devto: { api: site.api ?? elsewhere.origin },
    hashnode: { api: `${elsewhere.origin}/` },
    wordpressCom: { api: elsewhere.origin },
  }).pipe(
    Layer.provide(mediaOf([])),
    Layer.provide(Layer.merge(FetchHttpClient.layer, OpenOutboundGuard))
  );

const credentialsFor = (site: SiteUnderTest) =>
  credentialsOf({ accountId: site.root, platform: site.platform }, [
    site.credential,
  ]);

/** The platforms as production runs them, every channel on `site`. */
export const sitePlatformsOn = (site: SiteUnderTest) =>
  RoutedPlatformPublisher.pipe(
    Layer.provide(
      withSiteClients(
        platformClientsWith({
          discordHosts: { api: elsewhere.origin },
          googleBusinessApi: elsewhere,
          linkedinApi: elsewhere,
          mastodonScheme: "http:",
          metaAppSecret: Option.none(),
          metaHosts: {
            facebookDialog: elsewhere,
            facebookGraph: elsewhere,
            facebookUpload: elsewhere,
            instagramApi: elsewhere,
            instagramAuthorize: elsewhere,
            instagramGraph: elsewhere,
            threadsAuthorize: elsewhere,
            threadsGraph: elsewhere,
          },
          pinterestApi: elsewhere,
          slackHosts: { api: elsewhere.origin, uploads: elsewhere.origin },
          snapchatApi: elsewhere,
          telegramHosts: { api: elsewhere.origin },
          tiktokApi: elsewhere,
          tiktokPullFrom: Option.none(),
          timing: testTiming,
          videoService: elsewhere,
          xApi: elsewhere,
          youtubeApi: elsewhere,
          youtubeDailyThumbnails: 100,
          youtubeDailyUploads: 100,
        })
      )
    ),
    Layer.provideMerge(
      Layer.mergeAll(
        credentialsFor(site),
        mediaOf([]),
        callsOn(site),
        LinkShortener.none,
        PostMeter.unmetered,
        RecordedArticles.none,
        DrizzlePublicationProgress,
        DrizzlePublicationJournal,
        DrizzleSiteFiles,
        DrizzleUploadSessions,
        DrizzlePlatformQuota,
        DrizzleRecordedPosts
      )
    ),
    Layer.provide(
      Layer.mergeAll(
        FetchHttpClient.layer,
        OpenOutboundGuard,
        Mac.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto)),
        SecureRandom.layerWebCrypto,
        Digest.layerWebCrypto,
        Cipher.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto))
      )
    )
  );

/**
 * The live-post clients of `site`: a removal is the adapter's, as
 * unpublishing makes it; nothing is edited.
 */
export const siteLiveOn = (site: SiteUnderTest) =>
  Layer.effect(
    LivePostClients,
    Effect.gen(function* SiteLive() {
      const calls = yield* SiteCalls;
      const remover = siteLivePost(calls);

      return LivePostClients.of({
        edit: () => Effect.fail(new PlatformUnavailable()),
        remove: ({ platformPostId }) =>
          remover(
            {
              accessToken: Redacted.make(site.credential),
              accountId: site.root,
              connection: Option.none(),
              platform: site.platform,
            },
            platformPostId
          ).pipe(
            Effect.catchTag("TokenRejected", () =>
              Effect.fail(new PlatformUnavailable())
            )
          ),
      });
    })
  ).pipe(Layer.provide(callsOn(site)));
