import { Effect, Match } from "effect";

import type { RemovalFailure } from "#publishing/application/live-post-clients.ts";
import type { SiteAdapter } from "#publishing/application/site-calls.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import type { LivePostEditor } from "#publishing/infrastructure/platforms/live-post-editor.ts";
import { asRemovalFailure } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import type { LivePostRemover } from "#publishing/infrastructure/platforms/live-post-remover.ts";
import {
  articleOf,
  siteCodeOf,
} from "#publishing/infrastructure/platforms/sites/site-client.ts";
import type { SiteFileJournal } from "#shared/application/site-call-journal.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import { asItIs } from "#shared/domain/rich-text/site-standing.ts";
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

/**
 * Replaces what a website's post says with the adapter's own call
 * (`update`): its title, excerpt, featured image, tags and categories
 * from the edit's options, and its body, the edit's rich text or its text
 * and images written as one, as publishing writes them (`articleOf`). The
 * site keeps the post's status and its date. A file the site took for
 * the target already is not sent again (`siteFilesOf`); one it no longer
 * has is sent anew. A site's code is kept as `<platform>:<code>`.
 */
export const siteLiveEdit =
  (
    calls: SiteAdapter,
    journalOf: (targetId: PostTargetId, channelId: ChannelId) => SiteFileJournal
  ): LivePostEditor =>
  (token, edit) => {
    const { platform } = token;
    const { channelId, site } = edit;

    if (!isSitePlatform(platform)) {
      return Effect.fail(
        new BadRequest({ code: ownRefusalCodes.channelDisconnected })
      );
    }

    // The registry reads every edit from its change, which gives both.
    if (site === undefined || channelId === undefined) {
      return Effect.die("A website's edit without its target");
    }

    const article = articleOf({
      body: site.body,
      channelId,
      media: edit.media,
      options: edit.options,
      text: edit.text,
      workspaceId: site.workspaceId,
    });

    return calls
      .update(
        article,
        journalOf(site.targetId, channelId),
        edit.platformPostId,
        {
          credential: token.accessToken,
          platform,
          root: token.accountId,
        },
        asItIs
      )
      .pipe(
        Effect.as("edited" as const),
        Effect.mapError((failure) =>
          siteRefusal(platform)(asRemovalFailure(failure))
        )
      );
  };
