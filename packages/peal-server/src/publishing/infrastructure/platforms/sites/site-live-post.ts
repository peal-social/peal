import { Effect, Match } from "effect";

import type { RemovalFailure } from "#publishing/application/live-post-clients.ts";
import type { SiteAdapter } from "#publishing/application/site-calls.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { asRemovalFailure } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import type { LivePostRemover } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import { siteCodeOf } from "#publishing/infrastructure/platforms/sites/site-client.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

// A site's refusal of a removal, its code as the target keeps a site's.
const siteRefusal =
  (platform: SitePlatform) =>
  (failure: RemovalFailure | TokenRejected): RemovalFailure | TokenRejected =>
    Match.value(failure).pipe(
      Match.tag(
        "BadRequest",
        ({ code }) => new BadRequest({ code: siteCodeOf(platform, code) })
      ),
      Match.orElse((other) => other)
    );

/**
 * Takes a website's post down with the adapter's own call (`remove`):
 * WordPress moves it to the site's trash (a post gone already is done),
 * DEV makes it a draft again, as DEV deletes nothing an API key made,
 * Hashnode removes it. A removed target stays published with its
 * `removedAt`, as every unpublished post does.
 */
export const siteLivePost =
  (calls: SiteAdapter): LivePostRemover =>
  (token, platformPostId) => {
    const { platform } = token;

    if (!isSitePlatform(platform)) {
      return Effect.fail(
        new BadRequest({ code: ownRefusalCodes.channelDisconnected })
      );
    }

    return calls
      .remove(platformPostId, {
        credential: token.accessToken,
        platform,
        root: token.accountId,
      })
      .pipe(
        Effect.as("removed" as const),
        Effect.mapError((failure) =>
          siteRefusal(platform)(asRemovalFailure(failure))
        )
      );
  };
