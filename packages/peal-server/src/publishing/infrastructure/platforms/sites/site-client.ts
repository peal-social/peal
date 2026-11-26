import {
  DateTime,
  Effect,
  Layer,
  Match,
  Option,
  Schedule,
  Schema,
} from "effect";

import { PlatformClients } from "#publishing/application/platform-client.ts";
import type {
  OutgoingPost,
  PlatformClient,
  SiteCall,
} from "#publishing/application/platform-client.ts";
import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import type { PublishingToken } from "#publishing/application/platform-credentials.ts";
import { PublicationJournal } from "#publishing/application/publication-journal.ts";
import { PublicationProgress } from "#publishing/application/publication-progress.ts";
import { RecordedArticles } from "#publishing/application/recorded-articles.ts";
import { RecordedPosts } from "#publishing/application/recorded-posts.ts";
import { SiteCalls } from "#publishing/application/site-calls.ts";
import { SiteFiles } from "#publishing/application/site-files.ts";
import { DevtoOptions } from "#publishing/domain/devto-options.ts";
import { HashnodeOptions } from "#publishing/domain/hashnode-options.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import { bodyOfText } from "#publishing/domain/rich-override.ts";
import { siteUnchanged } from "#publishing/domain/site-hold.ts";
import type { SitePost } from "#publishing/domain/site-post.ts";
import { SiteProgressSchema } from "#publishing/domain/site-progress.ts";
import { WordPressComOptions } from "#publishing/domain/wordpress-com-options.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import type {
  SiteCallJournal,
  SiteFileJournal,
} from "#shared/application/site-call-journal.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type {
  Published,
  PublishResult,
} from "#shared/domain/publish-result.ts";
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";
import type { SiteArticleContent } from "#shared/domain/rich-text/site-article-content.ts";
import { siteRefusalCodes } from "#shared/domain/rich-text/site-refusal-codes.ts";
import type { SiteStanding } from "#shared/domain/rich-text/site-standing.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

// A website's post goes out as an article: the options of its platform
// give its title, excerpt, featured image, tags and categories, and how
// the site shows it; its body is the channel's rich text, or the post's
// text and images written as one. Peal sends it at the post's time, the
// site publishing it as it gets it, or, where the site publishes a post
// at a time itself, hands it over ahead (`#publishing/domain/site-hold.ts`):
// the router says in `OutgoingPost.site` what the call is to make of the
// post the site holds for the target (hold it for a time, keep it as a
// draft, take it off, or put it out), and the client records what the
// site then holds as soon as it answered, inside the gate.

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

/**
 * The article a website gets of a post, as its adapter takes it: from the
 * post that goes out, or from a live post's edit.
 */
export const articleOf = (
  post: Pick<
    OutgoingPost,
    "body" | "channelId" | "media" | "options" | "text" | "workspaceId"
  >
): OutgoingArticle => {
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
  siteUnchanged,
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

/**
 * The journal of a website target's files: those the site took
 * (`SiteFiles`, by target), never sent again, and the site's posts
 * another target or an article of the channel holds, never adopted.
 */
export const siteFilesOf =
  (stores: {
    readonly articles: RecordedArticles["Service"];
    readonly files: SiteFiles["Service"];
    readonly recorded: RecordedPosts["Service"];
  }) =>
  (targetId: PostTargetId, channelId: ChannelId): SiteFileJournal => ({
    featuredRefused: (mediaId) =>
      stores.files.featuredRefused(targetId, mediaId),
    fileSent: (mediaId, file) => stores.files.record(targetId, mediaId, file),
    filesSent: stores.files.sent(targetId),
    forgetFile: (mediaId) => stores.files.forget(targetId, mediaId),
    // Another target's post, or an article's, until articles are posts.
    recordedOn: (platformPostIds) =>
      Effect.all([
        stores.recorded.among(channelId, platformPostIds),
        stores.articles.among(channelId, platformPostIds),
      ]).pipe(Effect.map(([posts, made]) => new Set([...posts, ...made]))),
  });

/**
 * The article a call sends: held for the site to publish it itself at a
 * hand-over's time (`publishAt`), or as it goes out now.
 */
const articleFor = (post: OutgoingPost): OutgoingArticle => {
  const article = articleOf(post);
  const standing = post.site?.standing;

  return standing?._tag === "hold"
    ? { ...article, publishAt: Option.some(standing.at) }
    : article;
};

// The call of a target whose router said nothing of its site: published
// now, with nothing held there, as before hand-overs.
const publishingNow: SiteCall = {
  held: Option.none(),
  record: () => Effect.succeed(true),
  standing: { _tag: "publish" },
};

// Nothing for the site to change: nothing was sent.
const nothingToChange = new BadRequest({ code: siteUnchanged });

// What the site holds for a target is written while the call holds the
// gate; a database that refuses is tried again for a little while.
const recordRetry = Schedule.min([
  Schedule.exponential("100 millis", 2),
  Schedule.recurs(6),
]);

// Records what the site now holds for the target, as it answered.
const noted = (call: SiteCall, kept: Option.Option<SitePost>) =>
  call.record(kept).pipe(Effect.retry(recordRetry), Effect.orDie);

// The site's post, as the target keeps it.
const sitePostOf = (published: Published): SitePost =>
  withPermalink(
    { platformPostId: published.platformPostId },
    Option.fromUndefinedOr(published.permalink)
  );

const withPermalink = (
  held: SitePost,
  permalink: Option.Option<string>
): SitePost =>
  Option.match(permalink, {
    onNone: () => held,
    onSome: (address) => ({ ...held, permalink: address }),
  });

// The site's post, as a call that changed it answers.
const publishedAs = ({ permalink, platformPostId }: SitePost): PublishResult =>
  permalink === undefined
    ? { _tag: "published", platformPostId }
    : { _tag: "published", permalink, platformPostId };

/** The channel's token as a site's calls take it. */
export const siteToken = (token: PublishingToken): Option.Option<SiteToken> =>
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
  const articles = yield* RecordedArticles;
  const journal = yield* PublicationJournal;

  const journalOf = siteFilesOf({ articles, files, recorded });

  const filesOf = (post: OutgoingPost): SiteFileJournal =>
    journalOf(post.targetId, post.channelId);

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
              .find({ startedAt: at }, articleFor(post), filesOf(post), token)
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
          onNone: () => calls.publish(articleFor(post), callOf(post), token),
          onSome: Effect.succeed,
        })
      )
    );

  // The site's post changed to stand as `standing` says.
  const change = (
    post: OutgoingPost,
    token: SiteToken,
    platformPostId: string,
    standing: SiteStanding
  ) =>
    calls.update(
      articleFor(post),
      filesOf(post),
      platformPostId,
      token,
      standing
    );

  // The site holds `made` for the target, to publish it itself at `at`:
  // recorded at once. A target gone meanwhile, with its draft, leaves
  // nobody to take it off but this call.
  const holding = (
    token: SiteToken,
    call: SiteCall,
    made: SitePost,
    at: DateTime.Utc
  ) =>
    noted(call, Option.some({ ...made, publishAt: at })).pipe(
      Effect.flatMap((kept) =>
        kept
          ? Effect.void
          : calls.remove(made.platformPostId, token).pipe(Effect.ignore)
      ),
      Effect.as(publishedAs(made))
    );

  // A new post on the site, held for `at`: looked for first when a call
  // of an earlier round or hand-over may have made it, then made.
  const madeFor = (
    post: OutgoingPost,
    token: SiteToken,
    call: SiteCall,
    at: DateTime.Utc
  ) =>
    calls
      .publish(articleFor(post), callOf(post), token)
      .pipe(
        Effect.flatMap((result) =>
          result._tag === "published"
            ? holding(token, call, sitePostOf(result), at)
            : Effect.succeed(result)
        )
      );

  // The post held for the site to publish it at `at`: the one the site
  // holds changed, else one an earlier call made and the site has,
  // else a new one.
  const holdFor = (
    post: OutgoingPost,
    token: SiteToken,
    call: SiteCall,
    at: DateTime.Utc
  ) => {
    const changed = (held: SitePost) =>
      change(post, token, held.platformPostId, { _tag: "hold", at }).pipe(
        Effect.flatMap((site) =>
          site._tag === "gone"
            ? noted(call, Option.none()).pipe(
                Effect.andThen(madeFor(post, token, call, at))
              )
            : holding(token, call, withPermalink(held, site.permalink), at)
        )
      );

    return Option.match(call.held, {
      onNone: () =>
        lookedFor(post, token).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => madeFor(post, token, call, at),
              onSome: (found) =>
                found._tag === "published"
                  ? changed(sitePostOf(found))
                  : Effect.succeed(found),
            })
          )
        ),
      onSome: changed,
    });
  };

  // The post the site holds, a draft again: kept for the next hand-over,
  // or forgotten once the site no longer has it.
  const takeBack = (post: OutgoingPost, token: SiteToken, call: SiteCall) =>
    Option.match(call.held, {
      onNone: () => Effect.fail(nothingToChange),
      onSome: (held) =>
        change(post, token, held.platformPostId, { _tag: "draft" }).pipe(
          Effect.flatMap((site) =>
            site._tag === "gone"
              ? noted(call, Option.none()).pipe(
                  Effect.andThen(Effect.fail(nothingToChange))
                )
              : noted(
                  call,
                  Option.some(
                    withPermalink(
                      { platformPostId: held.platformPostId },
                      Option.orElse(site.permalink, () =>
                        Option.fromUndefinedOr(held.permalink)
                      )
                    )
                  )
                ).pipe(Effect.as(publishedAs(held)))
          )
        ),
    });

  // The post the site holds, taken off it, as unpublishing does.
  const takeOff = (token: SiteToken, call: SiteCall) =>
    Option.match(call.held, {
      onNone: () => Effect.fail(nothingToChange),
      onSome: (held) =>
        calls
          .remove(held.platformPostId, token)
          .pipe(
            Effect.andThen(noted(call, Option.none())),
            Effect.as(publishedAs(held))
          ),
    });

  // The post out now: the one the site holds for the target put out, or
  // one made as any post's is.
  const publishNow = (post: OutgoingPost, token: SiteToken, call: SiteCall) =>
    Option.match(call.held, {
      onNone: () => sent(post, token),
      onSome: (held) =>
        change(post, token, held.platformPostId, { _tag: "publish" }).pipe(
          Effect.flatMap((site) =>
            site._tag === "gone"
              ? noted(call, Option.none()).pipe(
                  Effect.andThen(sent(post, token))
                )
              : Effect.succeed(publishedAs(withPermalink(held, site.permalink)))
          )
        ),
    });

  const publish = (post: OutgoingPost) =>
    onSite(post, (token) => {
      const call = post.site ?? publishingNow;

      return Match.valueTags(call.standing, {
        draft: () => takeBack(post, token, call),
        hold: ({ at }) => holdFor(post, token, call, at),
        publish: () => publishNow(post, token, call),
        remove: () => takeOff(token, call),
      });
    });

  // A run that stopped: nothing recorded means the call never reached its
  // commit, so nothing is on the site and the attempt is tried again as
  // a new one (`PlatformUnavailable`), through every check a publish
  // makes, the plan's included; the commit mark means the post may be
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

        const standing = post.site?.standing;

        return Option.match(mark, {
          onNone: () => Effect.fail(new PlatformUnavailable()),
          onSome: ({ at }) =>
            onSite(post, (token) =>
              calls
                .resume(
                  { startedAt: at },
                  articleFor(post),
                  filesOf(post),
                  token
                )
                .pipe(
                  // A hand-over's post found is held: recorded so.
                  Effect.flatMap((result) =>
                    standing?._tag === "hold" &&
                    post.site !== undefined &&
                    result._tag === "published"
                      ? holding(
                          token,
                          post.site,
                          sitePostOf(result),
                          standing.at
                        )
                      : Effect.succeed(result)
                  )
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
