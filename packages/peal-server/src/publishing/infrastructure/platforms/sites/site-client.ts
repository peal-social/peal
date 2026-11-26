import { DateTime, Effect, Layer, Match, Option, Schema } from "effect";

import { PlatformClients } from "#publishing/application/platform-client.ts";
import type {
  OutgoingPost,
  PlatformClient,
} from "#publishing/application/platform-client.ts";
import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import { PublicationJournal } from "#publishing/application/publication-journal.ts";
import { PublicationProgress } from "#publishing/application/publication-progress.ts";
import { RecordedPosts } from "#publishing/application/recorded-posts.ts";
import { SiteCalls } from "#publishing/application/site-calls.ts";
import { SiteFiles } from "#publishing/application/site-files.ts";
import { DevtoOptions } from "#publishing/domain/devto-options.ts";
import { HashnodeOptions } from "#publishing/domain/hashnode-options.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { bodyOfText } from "#publishing/domain/rich-override.ts";
import { SiteProgressSchema } from "#publishing/domain/site-progress.ts";
import { WordPressComOptions } from "#publishing/domain/wordpress-com-options.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import type {
  SiteCallJournal,
  SiteFileJournal,
} from "#shared/application/site-call-journal.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type { PublishResult } from "#shared/domain/publish-result.ts";
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";
import type { SiteArticleContent } from "#shared/domain/rich-text/site-article-content.ts";
import { siteRefusalCodes } from "#shared/domain/rich-text/site-refusal-codes.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

// A website's post goes out as an article: the options of its platform
// give its title, excerpt, featured image, tags and categories, and how
// the site shows it; its body is the channel's rich text, or the post's
// text and images written as one. Peal sends it at the post's time: the
// site publishes it as it gets it (`publishAt` none).

const isSiteOptions = Schema.is(
  Schema.Union([
    WordPressOptions,
    WordPressComOptions,
    DevtoOptions,
    HashnodeOptions,
  ])
);

type SiteOptions =
  | DevtoOptions
  | HashnodeOptions
  | WordPressComOptions
  | WordPressOptions;

/** The article a website gets of a post, as its adapter takes it. */
export const articleOf = (post: OutgoingPost): OutgoingArticle => {
  const options = post.options.pipe(Option.filter(isSiteOptions));

  const field = <A>(read: (chosen: SiteOptions) => A | undefined) =>
    options.pipe(
      Option.flatMap((chosen) => Option.fromUndefinedOr(read(chosen)))
    );

  const content: SiteArticleContent = {
    body: Option.getOrElse(post.body, () => bodyOfText(post.text, post.media)),
    categories: Option.getOrElse(
      field((chosen) =>
        "categories" in chosen ? chosen.categories : undefined
      ),
      () => []
    ),
    coverMediaId: field((chosen) => chosen.coverMediaId),
    excerpt: field((chosen) => chosen.excerpt),
    siteStatus: Option.getOrElse(
      field((chosen) => chosen.siteStatus),
      () => "publish" as const
    ),
    tags: Option.getOrElse(
      field((chosen) => chosen.tags),
      () => []
    ),
    title: Option.getOrElse(
      field((chosen) => chosen.title),
      () => ""
    ),
  };

  return {
    channelId: post.channelId,
    content,
    publishAt: Option.none(),
    workspaceId: post.workspaceId,
  };
};

/**
 * The codes a website's adapter refuses a call with that are Peal's own:
 * the site's own codes never read as one of them.
 */
const ownCodes: ReadonlySet<string> = new Set([
  ownRefusalCodes.channelDisabled,
  ownRefusalCodes.channelDisconnected,
  ownRefusalCodes.mediaRemoved,
  ownRefusalCodes.planLimit,
  siteRefusalCodes.channelDisconnected,
  siteRefusalCodes.sitePlanRequired,
]);

/**
 * A site's code as the target keeps it: Peal's own as they are, any other
 * prefixed with the platform and a colon (`wordpress:rest_cannot_create`),
 * as Slack's are `slack:<code>`, so the policy never reads a site's code
 * as one of Peal's reasons. One the adapter prefixed already stays.
 */
export const siteCodeOf = (platform: SitePlatform, code: string): string =>
  ownCodes.has(code) || code.startsWith(`${platform}:`)
    ? code
    : `${platform}:${code}`;

const prefixed =
  (platform: SitePlatform) =>
  (failure: PublishFailure): PublishFailure =>
    Match.valueTags(failure, {
      BadRequest: ({ code }) =>
        new BadRequest({ code: siteCodeOf(platform, code) }),
      MediaRejected: ({ code }) =>
        new MediaRejected({ code: siteCodeOf(platform, code) }),
      PlatformUnavailable: (unavailable) => unavailable,
      RateLimited: (limited) => limited,
      TokenExpired: (expired) => expired,
    });

const decodeProgress = Schema.decodeUnknownOption(
  Schema.toCodecJson(SiteProgressSchema)
);

const encodeProgress = Schema.encodeSync(
  Schema.toCodecJson(SiteProgressSchema)
);

// A refused search leaves the target to check: the post may be there.
const searchRefused = (): PublishResult => ({
  _tag: "unconfirmed",
  reason: "searchRefused",
});

// The channel's token as a site's calls take it.
const siteToken = (token: PublishingToken): Option.Option<SiteToken> =>
  isSitePlatform(token.platform)
    ? Option.some({
        credential: token.accessToken,
        platform: token.platform,
        root: token.accountId,
      })
    : Option.none();

/**
 * The client of a website's posts, on the platform `platform` (WordPress,
 * WordPress.com, DEV, Hashnode): each attempt's call through publishing's
 * site calls, with the target's journal. The commit mark is the call's
 * progress (`committing`), the files the target's (`SiteFiles`), and the
 * posts recorded on the channel's targets (`RecordedPosts`) are never
 * adopted. A new round first looks for the post a call of an earlier
 * round may have made (`committedBefore`).
 */
export const siteClient = Effect.fn("SiteClient.make")(function* siteClient(
  platform: SitePlatform
) {
  const calls = yield* SiteCalls;
  const credentials = yield* PlatformCredentials;
  const progress = yield* PublicationProgress;
  const files = yield* SiteFiles;
  const recorded = yield* RecordedPosts;
  const journal = yield* PublicationJournal;

  const filesOf = (post: OutgoingPost): SiteFileJournal => ({
    featuredRefused: (mediaId) => files.featuredRefused(post.targetId, mediaId),
    fileSent: (mediaId, file) => files.record(post.targetId, mediaId, file),
    filesSent: files.sent(post.targetId),
    forgetFile: (mediaId) => files.forget(post.targetId, mediaId),
    recordedOn: (platformPostIds) =>
      recorded.among(post.channelId, platformPostIds),
  });

  // The commit mark, recorded and committed before the post's request.
  const callOf = (post: OutgoingPost): SiteCallJournal => ({
    ...filesOf(post),
    committing: Effect.gen(function* committing() {
      const at = yield* DateTime.now;

      yield* progress.record(
        post.idempotencyKey,
        encodeProgress({ _tag: "committing", at })
      );

      return at;
    }),
  });

  const onSite = <A>(
    post: OutgoingPost,
    call: (token: SiteToken) => Effect.Effect<A, PublishFailure | TokenRejected>
  ) =>
    credentials
      .withToken(post.channelId, (token) =>
        Option.match(siteToken(token), {
          onNone: () =>
            Effect.fail(
              new BadRequest({ code: ownRefusalCodes.channelDisconnected })
            ),
          onSome: call,
        })
      )
      .pipe(Effect.mapError(prefixed(platform)));

  // A new round looks for the post an earlier round's call may have made
  // before it makes one: adopted when the site has exactly it.
  const lookedFor = (post: OutgoingPost, token: SiteToken) =>
    journal.committedBefore(post.targetId, post.round).pipe(
      Effect.orDie,
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.succeed(Option.none<PublishResult>()),
          onSome: (at) =>
            calls
              .find({ startedAt: at }, articleOf(post), filesOf(post), token)
              .pipe(
                Effect.map((search) =>
                  Match.valueTags(search, {
                    found: ({ result }) => Option.some(result),
                    none: () => Option.none<PublishResult>(),
                    several: () =>
                      Option.some<PublishResult>({
                        _tag: "unconfirmed",
                        reason: "severalOnSite",
                      }),
                  })
                ),
                Effect.catchTags({
                  BadRequest: () =>
                    Effect.succeed(Option.some(searchRefused())),
                  MediaRejected: () =>
                    Effect.succeed(Option.some(searchRefused())),
                })
              ),
        })
      )
    );

  const sent = (post: OutgoingPost, token: SiteToken) =>
    lookedFor(post, token).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => calls.publish(articleOf(post), callOf(post), token),
          onSome: Effect.succeed,
        })
      )
    );

  const publish = (post: OutgoingPost) =>
    onSite(post, (token) => sent(post, token));

  // A run that stopped: nothing recorded means the call never reached its
  // commit, so it is sent anew; the commit mark means the post may be
  // there, looked for from then, never made again.
  const resume = (post: OutgoingPost) =>
    progress.read(post.idempotencyKey).pipe(
      Effect.orDie,
      Effect.flatMap((read) => {
        if (read._tag === "unknownCall") {
          return Effect.succeed<PublishResult>({
            _tag: "unconfirmed",
            reason: "interrupted",
          });
        }

        const mark = read.recorded.pipe(Option.flatMap(decodeProgress));

        return Option.match(mark, {
          onNone: () => publish(post),
          onSome: ({ at }) =>
            onSite(post, (token) =>
              calls.resume(
                { startedAt: at },
                articleOf(post),
                filesOf(post),
                token
              )
            ),
        });
      })
    );

  const client: PlatformClient = { platform, publish, resume };

  return client;
});

/**
 * The platforms' clients, with the websites' over them: a post's target on
 * WordPress, WordPress.com, DEV or Hashnode goes out through `siteClient`,
 * any other through the clients `inner` gives. Needs what `siteClient`
 * needs: SiteCalls, PlatformCredentials, PublicationProgress, SiteFiles,
 * RecordedPosts and the PublicationJournal.
 */
export const withSiteClients = <E, R>(
  inner: Layer.Layer<PlatformClients, E, R>
) =>
  Layer.effect(
    PlatformClients,
    Effect.gen(function* SiteClientsLive() {
      const others = yield* PlatformClients;

      const sites: Readonly<Record<SitePlatform, PlatformClient>> = {
        devto: yield* siteClient("devto"),
        hashnode: yield* siteClient("hashnode"),
        wordpress: yield* siteClient("wordpress"),
        wordpressCom: yield* siteClient("wordpressCom"),
      };

      return PlatformClients.of({
        for: (platform) =>
          isSitePlatform(platform)
            ? Option.some(sites[platform])
            : others.for(platform),
      });
    })
  ).pipe(Layer.provide(inner));
