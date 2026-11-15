import { DateTime, Duration, Effect, Option, Schema } from "effect";
import { HttpClientRequest } from "effect/http";

import { ArticleJournal } from "#publishing/application/article-journal.ts";
import type { SiteFile } from "#publishing/application/article-journal.ts";
import { ArticleStore } from "#publishing/application/article-store.ts";
import { MediaForPublishing } from "#publishing/application/media-for-publishing.ts";
import type { SiteToken } from "#publishing/application/site-credentials.ts";
import type {
  SitePublishRequest,
  SiteSearch,
} from "#publishing/application/site-publisher.ts";
import { articleMarkdown } from "#publishing/domain/article-markdown.ts";
import { articleMediaOf } from "#publishing/domain/article.ts";
import type { Article } from "#publishing/domain/article.ts";
import {
  ownRefusalCodes,
  platformRefusalCodes,
} from "#publishing/domain/own-refusals.ts";
import { hashnodeSlugOf } from "#publishing/domain/site-rules.ts";
import type { SiteAdapter } from "#publishing/infrastructure/platforms/site-adapter.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import type {
  PublishResult,
  UnconfirmedReason,
} from "#shared/domain/publish-result.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  hashnodeAnswerOf,
  hashnodeRequest,
  isPlanRefusal,
} from "#shared/infrastructure/platforms/hashnode-api.ts";
import type {
  GraphQlVariables,
  HashnodeError,
  HashnodeHosts,
} from "#shared/infrastructure/platforms/hashnode-api.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import {
  publicHttpClient,
  publicHttpClientWith,
  streamedBody,
} from "#shared/infrastructure/platforms/public-http.ts";

// Articles on a Hashnode publication, through its GraphQL API (its
// schema, and its own agent guide): each file the article shows is
// uploaded to the address `createImageUploadURL` gives, then confirmed
// (`confirmImageUpload`), which answers where Hashnode's CDN serves it;
// the post is made with one `publishPost` (or `createDraft` for a draft
// there), the commit: `title`, `contentMarkdown` (written by
// `article-markdown.ts`), `subtitle`, `coverImage`, `tags` by slug.
// Hashnode's API cannot publish a post at a time (scheduling refuses
// it, `siteStatusNotTaken`). It keeps no idempotency key: a post whose
// answer was lost is looked for among the publication's latest posts (or
// drafts), by its title and its Markdown, and adopted only when exactly
// one, not another article's, matches. Hashnode may answer a read from a
// cache for some 25 seconds. `updatePost` (`updateDraft`) sends it again,
// `removePost` (`deleteDraft`) removes it. Every request needs Hashnode's
// Pro plan on the publication: one refused for want of it fails as
// `sitePlanRequired`.

// Uploads take longer than the API's calls.
const uploadTimeout = Duration.minutes(10);

// Hashnode takes images of 8 MB at most, and no SVG.
const maxImageBytes = 8 * 1024 * 1024;

// How long Hashnode may answer a read from its cache (some 25 seconds,
// by its own guide), with room: a search sooner may miss a post just made.
const readCacheLife = Duration.minutes(1);

// The codes Hashnode refuses an operation with, documented: any other on
// the commit may follow a post made.
const commitRefusals: ReadonlySet<string> = new Set([
  "bad_user_input",
  "forbidden",
  "not_found",
  platformRefusalCodes.sitePlanRequired,
]);

// How far before the call a post made by it may say it was published.
const clockSlack = Duration.minutes(1);

const searchWindow = Duration.days(1);

// The latest posts, and drafts, read when looking for one.
const searchPosts = 20;

const searchDrafts = 50;

// A draft's id, kept apart from a post's: they are changed and removed
// by mutations of their own.
const draftPrefix = "draft:";

interface Operation {
  readonly name: string;
  readonly query: string;
}

const operation = (name: string, query: string): Operation => ({
  name,
  query,
});

const imageUpload = operation(
  "PealImageUpload",
  "mutation PealImageUpload($input: CreateImageUploadInput!) { createImageUploadURL(input: $input) { presignedPut { url cdnUrl key } } }"
);

const confirmImage = operation(
  "PealConfirmImage",
  "mutation PealConfirmImage($input: ConfirmImageUploadInput!) { confirmImageUpload(input: $input) { ok cdnUrl } }"
);

const publishPost = operation(
  "PealPublishPost",
  "mutation PealPublishPost($input: PublishPostInput!) { publishPost(input: $input) { post { id url } } }"
);

const createDraft = operation(
  "PealCreateDraft",
  "mutation PealCreateDraft($input: CreateDraftInput!) { createDraft(input: $input) { draft { id } } }"
);

const updatePost = operation(
  "PealUpdatePost",
  "mutation PealUpdatePost($input: UpdatePostInput!) { updatePost(input: $input) { post { id } } }"
);

const updateDraft = operation(
  "PealUpdateDraft",
  "mutation PealUpdateDraft($input: UpdateDraftInput!) { updateDraft(input: $input) { draft { id } } }"
);

const removePost = operation(
  "PealRemovePost",
  "mutation PealRemovePost($input: RemovePostInput!) { removePost(input: $input) { post { id } } }"
);

const deleteDraft = operation(
  "PealDeleteDraft",
  "mutation PealDeleteDraft($input: DeleteDraftInput!) { deleteDraft(input: $input) { draft { id } } }"
);

const recentPosts = operation(
  "PealRecentPosts",
  `query PealRecentPosts($id: ObjectId!) { publication(id: $id) { posts(first: ${searchPosts}) { edges { node { id title url publishedAt content { markdown } } } } } }`
);

const recentDrafts = operation(
  "PealDrafts",
  `query PealDrafts($id: ObjectId!) { publication(id: $id) { drafts(first: ${searchDrafts}) { edges { node { id title updatedAt content { markdown } } } } } }`
);

const UploadSchema = Schema.Struct({
  createImageUploadURL: Schema.Struct({
    presignedPut: Schema.Struct({
      cdnUrl: Schema.String,
      key: Schema.String,
      url: Schema.String,
    }),
  }),
});

const ConfirmedSchema = Schema.Struct({
  confirmImageUpload: Schema.Struct({
    cdnUrl: Schema.optionalKey(Schema.NullOr(Schema.String)),
    ok: Schema.Boolean,
  }),
});

const PublishedSchema = Schema.Struct({
  publishPost: Schema.Struct({
    post: Schema.Struct({
      id: Schema.String,
      url: Schema.optionalKey(Schema.String),
    }),
  }),
});

const DraftedSchema = Schema.Struct({
  createDraft: Schema.Struct({ draft: Schema.Struct({ id: Schema.String }) }),
});

const FoundSchema = Schema.Struct({
  content: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ markdown: Schema.String }))
  ),
  id: Schema.String,
  publishedAt: Schema.optionalKey(Schema.NullOr(Schema.String)),
  title: Schema.optionalKey(Schema.NullOr(Schema.String)),
  updatedAt: Schema.optionalKey(Schema.NullOr(Schema.String)),
  url: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

type Found = typeof FoundSchema.Type;

const PostsSchema = Schema.Struct({
  publication: Schema.NullOr(
    Schema.Struct({
      posts: Schema.Struct({
        edges: Schema.Array(Schema.Struct({ node: FoundSchema })),
      }),
    })
  ),
});

const DraftsSchema = Schema.Struct({
  publication: Schema.NullOr(
    Schema.Struct({
      drafts: Schema.Struct({
        edges: Schema.Array(Schema.Struct({ node: FoundSchema })),
      }),
    })
  ),
});

type Failure = BadRequest | MediaRejected | PlatformUnavailable | RateLimited;

/**
 * How Hashnode refused an operation, from its codes: its own
 * UNAUTHENTICATED is a refused token; FORBIDDEN for want of the Pro plan
 * is the publication's plan; any other is a refusal of what was sent,
 * but an internal error, which is Hashnode down.
 */
const refusalOf = (
  errors: readonly HashnodeError[],
  upload: boolean
): Failure | TokenRejected => {
  if (errors.some((error) => error.code === "UNAUTHENTICATED")) {
    return new TokenRejected();
  }

  if (errors.some(isPlanRefusal)) {
    return new BadRequest({ code: platformRefusalCodes.sitePlanRequired });
  }

  const [first] = errors;

  if (first === undefined || first.code === "INTERNAL_SERVER_ERROR") {
    return new PlatformUnavailable();
  }

  const code = first.code === "" ? "refused" : first.code.toLowerCase();

  return upload ? new MediaRejected({ code }) : new BadRequest({ code });
};

const guardRefusalOf = (refused: OutboundRequestRefused) =>
  refused.reason === "lookupFailed"
    ? new PlatformUnavailable()
    : new BadRequest({ code: ownRefusalCodes.channelDisconnected });

const webAddress = (link: string | null | undefined): string | undefined => {
  if (link === null || link === undefined || !URL.canParse(link)) {
    return undefined;
  }

  const { protocol } = new URL(link);

  return protocol === "https:" || protocol === "http:" ? link : undefined;
};

const published = (
  id: string,
  url: string | null | undefined
): PublishResult => {
  const permalink = webAddress(url);
  const platformPostId = PlatformPostIdSchema.make(id);

  return permalink === undefined
    ? { _tag: "published", platformPostId }
    : { _tag: "published", permalink, platformPostId };
};

const isDraft = (article: Article) => article.content.siteStatus === "draft";

// What the article says, as Hashnode takes it, its files where its CDN
// serves them.
const contentOf = (
  article: Article,
  addresses: ReadonlyMap<MediaAssetId, string>
) => {
  const { content } = article;

  const cover = content.coverMediaId.pipe(
    Option.flatMap((id) => Option.fromUndefinedOr(addresses.get(id)))
  );

  return {
    contentMarkdown: articleMarkdown(content.body, addresses),
    cover,
    subtitle: Option.getOrNull(content.excerpt),
    tags: content.tags.map((name) => ({
      name: name.trim(),
      slug: hashnodeSlugOf(name),
    })),
    title: content.title.trim(),
  };
};

type Content = ReturnType<typeof contentOf>;

// A post's fields, or a draft's, which takes its cover apart.
const postInput = (content: Content) => ({
  contentMarkdown: content.contentMarkdown,
  coverImage: Option.getOrNull(content.cover),
  subtitle: content.subtitle,
  tags: content.tags,
  title: content.title,
});

const draftInput = (content: Content) => ({
  contentMarkdown: content.contentMarkdown,
  ...Option.match(content.cover, {
    onNone: () => ({}),
    onSome: (coverImageURL) => ({ coverImageOptions: { coverImageURL } }),
  }),
  subtitle: content.subtitle,
  tags: content.tags,
  title: content.title,
});

/** The calls to Hashnode, its API at `hosts`. */
export const hashnodeSiteAdapter = Effect.fnUntraced(
  function* hashnodeSiteAdapter(hosts: HashnodeHosts) {
    const store = yield* ArticleStore;
    const journal = yield* ArticleJournal;
    const library = yield* MediaForPublishing;
    const api = yield* publicHttpClient;
    const uploads = yield* publicHttpClientWith({ timeout: uploadTimeout });

    // One operation: its data, or how Hashnode refused it; a failure to
    // reach it, or an answer that is not GraphQL's, is Hashnode down.
    const call = <A, I>(
      token: SiteToken,
      sent: Operation,
      variables: GraphQlVariables,
      schema: Schema.Codec<A, I>,
      upload = false
    ) =>
      api
        .execute(hashnodeRequest(hosts, token.credential, sent, variables))
        .pipe(
          Effect.catchTags({
            HttpClientError: () => Effect.fail(new PlatformUnavailable()),
            OutboundRequestRefused: (refused) =>
              Effect.fail(guardRefusalOf(refused)),
          }),
          Effect.flatMap((response) =>
            response.status === 429
              ? Effect.fail(new RateLimited())
              : hashnodeAnswerOf(schema)(response)
          ),
          Effect.flatMap((answer) =>
            Option.match(answer, {
              onNone: () => Effect.fail(new PlatformUnavailable()),
              onSome: (known) =>
                known._tag === "data"
                  ? Effect.succeed(known.data)
                  : Effect.fail(refusalOf(known.errors, upload)),
            })
          )
        );

    // Sends one file: the address Hashnode's CDN serves it at.
    const upload = Effect.fn("HashnodeArticles.upload")(function* upload(
      token: SiteToken,
      article: Article,
      mediaId: MediaAssetId
    ) {
      const described = yield* library.describe(article.workspaceId, mediaId);

      if (
        described.byteSize > maxImageBytes ||
        !described.contentType.startsWith("image/") ||
        described.contentType === "image/svg+xml"
      ) {
        return yield* new MediaRejected({ code: "image_not_taken" });
      }

      const { presignedPut } = (yield* call(
        token,
        imageUpload,
        { input: { contentType: described.contentType } },
        UploadSchema,
        true
      )).createImageUploadURL;

      yield* Effect.scoped(
        Effect.gen(function* putting() {
          const bytes = yield* library.held(article.workspaceId, mediaId);

          const response = yield* uploads
            .execute(
              HttpClientRequest.put(presignedPut.url).pipe(
                streamedBody(bytes, {
                  contentLength: described.byteSize,
                  contentType: described.contentType,
                })
              )
            )
            .pipe(
              Effect.catchTags({
                HttpClientError: () => Effect.fail(new PlatformUnavailable()),
                OutboundRequestRefused: (refused) =>
                  Effect.fail(guardRefusalOf(refused)),
              })
            );

          if (response.status >= 500) {
            return yield* new PlatformUnavailable();
          }

          return yield* response.status >= 200 && response.status < 300
            ? Effect.void
            : new MediaRejected({ code: `upload_${response.status}` });
        })
      );

      const confirmed = (yield* call(
        token,
        confirmImage,
        { input: { key: presignedPut.key } },
        ConfirmedSchema,
        true
      )).confirmImageUpload;

      if (!confirmed.ok) {
        return yield* new MediaRejected({ code: "upload_not_confirmed" });
      }

      return confirmed.cdnUrl ?? presignedPut.cdnUrl;
    });

    // The files' addresses: those sent before reused, the others sent now
    // when `send`, else left out.
    const filesOf = Effect.fn("HashnodeArticles.filesOf")(function* filesOf(
      token: SiteToken,
      article: Article,
      send: boolean
    ) {
      const sent = yield* journal
        .filesSent(article.id)
        .pipe(Effect.mapError(() => new PlatformUnavailable()));

      const addresses = new Map<MediaAssetId, string>();
      let complete = true;

      for (const mediaId of new Set(articleMediaOf(article.content))) {
        const known = sent.get(mediaId);

        if (known !== undefined) {
          addresses.set(mediaId, known.sourceUrl);
          continue;
        }

        if (!send) {
          complete = false;
          continue;
        }

        const file: SiteFile = {
          id: 0,
          sourceUrl: yield* upload(token, article, mediaId),
        };

        yield* journal
          .fileSent(article.id, mediaId, file)
          .pipe(Effect.mapError(() => new PlatformUnavailable()));

        addresses.set(mediaId, file.sourceUrl);
      }

      return { addresses, complete };
    });

    // The post, or the draft, this call made: of the article's title and
    // Markdown, not another article's, a post published within the call's
    // window. Hashnode lists the latest first.
    const lookUp = Effect.fn("HashnodeArticles.lookUp")(function* lookUp(
      token: SiteToken,
      article: Article,
      startedAt: DateTime.Utc
    ) {
      const { addresses, complete } = yield* filesOf(token, article, false);
      const expected = contentOf(article, addresses);
      const since = DateTime.subtractDuration(startedAt, clockSlack);
      const until = DateTime.addDuration(startedAt, searchWindow);
      const draft = isDraft(article);

      const listed: readonly Found[] = draft
        ? (
            (yield* call(token, recentDrafts, { id: token.root }, DraftsSchema))
              .publication?.drafts.edges ?? []
          ).map(({ node }) => node)
        : (
            (yield* call(token, recentPosts, { id: token.root }, PostsSchema))
              .publication?.posts.edges ?? []
          ).map(({ node }) => node);

      const inWindow = (at: string | null | undefined) =>
        Option.fromNullishOr(at).pipe(
          Option.flatMap((written) => DateTime.make(written)),
          Option.exists((when) =>
            DateTime.between(when, { maximum: until, minimum: since })
          )
        );

      const matching = listed.filter(
        (post) =>
          (post.title ?? "").trim() === expected.title &&
          (!complete ||
            (post.content?.markdown ?? "").trim() ===
              expected.contentMarkdown.trim()) &&
          inWindow(draft ? post.updatedAt : post.publishedAt)
      );

      const idOf = (post: Found) =>
        draft ? `${draftPrefix}${post.id}` : post.id;

      const recorded = yield* store
        .recordedOn(article.channelId, matching.map(idOf))
        .pipe(Effect.orDie);

      const unclaimed = matching.filter((post) => !recorded.has(idOf(post)));
      const [only] = unclaimed;

      if (only === undefined) {
        const none: SiteSearch = { _tag: "none" };

        return none;
      }

      const search: SiteSearch =
        unclaimed.length > 1
          ? { _tag: "several" }
          : { _tag: "found", result: published(idOf(only), only.url) };

      return search;
    });

    const lookedUp = (
      token: SiteToken,
      article: Article,
      startedAt: DateTime.Utc,
      reason: UnconfirmedReason
    ) =>
      lookUp(token, article, startedAt).pipe(
        Effect.map((search): PublishResult =>
          search._tag === "found"
            ? search.result
            : { _tag: "unconfirmed", reason }
        ),
        Effect.catchTag(
          ["PlatformUnavailable", "RateLimited", "BadRequest", "MediaRejected"],
          (): Effect.Effect<PublishResult> =>
            Effect.succeed({ _tag: "unconfirmed", reason })
        )
      );

    const publish = Effect.fn("HashnodeArticles.publish")(function* publish(
      request: SitePublishRequest,
      article: Article,
      token: SiteToken
    ) {
      const { addresses } = yield* filesOf(token, article, true);
      const content = contentOf(article, addresses);
      const draft = isDraft(article);

      // From here a run that stops looks for the post, never makes it.
      const committedAt = yield* request.committing.pipe(
        Effect.mapError(() => new PlatformUnavailable())
      );

      const input = {
        ...(draft ? draftInput(content) : postInput(content)),
        publicationId: token.root,
      };

      // The commit: once it may have reached Hashnode, nothing is sent
      // again. No answer, a 5xx or an internal error leave it unknown.
      const made = yield* (
        draft
          ? call(token, createDraft, { input }, DraftedSchema).pipe(
              Effect.map(({ createDraft: { draft: drafted } }) =>
                published(`${draftPrefix}${drafted.id}`, undefined)
              )
            )
          : call(token, publishPost, { input }, PublishedSchema).pipe(
              Effect.map(({ publishPost: { post } }) =>
                published(post.id, post.url)
              )
            )
      ).pipe(
        Effect.map(Option.some),
        Effect.catchTag("PlatformUnavailable", () => Effect.succeedNone),
        // A code Hashnode does not document as a refusal says nothing of
        // whether the post was made: it is looked for.
        Effect.catchIf(
          (failure) =>
            failure._tag === "BadRequest" && !commitRefusals.has(failure.code),
          () => Effect.succeedNone
        )
      );

      return Option.isSome(made)
        ? made.value
        : yield* lookedUp(token, article, committedAt, "noResponse");
    });

    const update = Effect.fn("HashnodeArticles.update")(function* update(
      article: Article,
      platformPostId: string,
      token: SiteToken
    ) {
      const { addresses } = yield* filesOf(token, article, true);
      const content = contentOf(article, addresses);

      yield* platformPostId.startsWith(draftPrefix)
        ? call(
            token,
            updateDraft,
            {
              input: {
                ...draftInput(content),
                draftId: platformPostId.slice(draftPrefix.length),
              },
            },
            Schema.Unknown
          )
        : call(
            token,
            updatePost,
            { input: { ...postInput(content), id: platformPostId } },
            Schema.Unknown
          );
    });

    // Removed from the publication; one gone already is done.
    const remove = Effect.fn("HashnodeArticles.remove")(function* remove(
      _article: Article,
      platformPostId: string,
      token: SiteToken
    ) {
      const removal = platformPostId.startsWith(draftPrefix)
        ? call(
            token,
            deleteDraft,
            { input: { draftId: platformPostId.slice(draftPrefix.length) } },
            Schema.Unknown
          )
        : call(
            token,
            removePost,
            { input: { id: platformPostId } },
            Schema.Unknown
          );

      yield* removal.pipe(
        Effect.catchIf(
          (failure) =>
            failure._tag === "BadRequest" && failure.code === "not_found",
          () => Effect.void
        )
      );
    });

    // Looks for the post an earlier round's call may have made, never
    // while Hashnode's cached reads may still hide it: within their life
    // since that call, the search waits, as Hashnode unavailable, and the
    // attempt is made again later.
    const find = Effect.fn("HashnodeArticles.find")(function* find(
      request: SitePublishRequest,
      article: Article,
      token: SiteToken
    ) {
      const now = yield* DateTime.now;
      const readable = DateTime.addDuration(request.startedAt, readCacheLife);

      if (DateTime.isLessThan(now, readable)) {
        return yield* new PlatformUnavailable();
      }

      return yield* lookUp(token, article, request.startedAt);
    });

    const adapter: SiteAdapter = {
      find,
      publish,
      remove,
      resume: (request, article, token) =>
        lookedUp(token, article, request.startedAt, "interrupted"),
      update,
    };

    return adapter;
  }
);
