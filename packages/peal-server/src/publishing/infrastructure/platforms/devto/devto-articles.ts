import { Clock, DateTime, Duration, Effect, Option, Ref, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

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
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
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
  devtoErrorOf,
  devtoUrl,
  withDevToKey,
} from "#shared/infrastructure/platforms/devto-api.ts";
import type { DevToHosts } from "#shared/infrastructure/platforms/devto-api.ts";
import {
  formBoundary,
  multipartBody,
} from "#shared/infrastructure/platforms/multipart-stream.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import {
  publicHttpClient,
  publicHttpClientWith,
  streamedBody,
} from "#shared/infrastructure/platforms/public-http.ts";
import { retryAfterOf } from "#shared/infrastructure/platforms/retry-after.ts";

// Articles on DEV, through Forem's API v1 (developers.forem.com/api/v1,
// and forem/forem's code where its specification is silent): each file
// the article shows goes to `POST /api/images` (one a request, the
// `image` field of a multipart form), which answers the address DEV
// serves it at; the article is made with one `POST /api/articles`, the
// commit: `title`, `body_markdown` (written by `article-markdown.ts`),
// `description`, `tags`, `main_image`, and `published` (false for a
// draft; true with a future `published_at`, which DEV publishes itself
// then). DEV takes the title and the description as plain text, and
// escapes them itself. It keeps no idempotency key: a post whose answer
// was lost is looked for among the member's articles
// (`/api/articles/me/all`, drafts first), by its title and its body,
// and adopted only when exactly one, not another article's, matches.
// `PUT /api/articles/{id}` sends it again; DEV has no way to delete an
// article, so unpublishing makes it a draft there (`published` false).
// DEV takes one write a second per key: the adapter waits between its
// own, and a 429 waits for its `Retry-After`.

// Uploads take longer than the API's calls.
const uploadTimeout = Duration.minutes(10);

// A listing carries each article's Markdown, up to 800 KB each.
const listingBytes = 32 * 1024 * 1024;

// DEV's limit on writes with one key (Rack::Attack's, per second).
const writeSpacing = Duration.millis(1100);

// How far before the call a post made by it may say it was published:
// DEV's clock and Peal's may differ; and how long after.
const clockSlack = Duration.minutes(1);

const searchWindow = Duration.days(1);

// The articles read a page, and the pages read, when looking for one.
const searchPageSize = 30;

const maxSearchPages = 5;

type Client = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

const CreatedSchema = Schema.Struct({
  id: Schema.Number,
  url: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

const ImageSchema = Schema.Struct({ url: Schema.String });

const ListedSchema = Schema.Struct({
  body_markdown: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.Number,
  published: Schema.optionalKey(Schema.Boolean),
  published_at: Schema.optionalKey(Schema.NullOr(Schema.String)),
  title: Schema.String,
  url: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

// The code Peal keeps of a refusal: DEV answers sentences, not codes.
const statusCodes = new Map([
  [400, "bad_request"],
  [403, "forbidden"],
  [404, "not_found"],
  [413, "payload_too_large"],
  [422, "unprocessable_entity"],
]);

const codeFor = (status: number) => statusCodes.get(status) ?? `http_${status}`;

/**
 * How DEV refused a request, from its status and its own error: only its
 * 401, in its words, is a refused key; anything a proxy says, or a 5xx,
 * is DEV unreachable.
 */
const refusalOf = Effect.fnUntraced(function* refusalOf(
  response: HttpClientResponse.HttpClientResponse,
  // Whether the request sent a file, which a refusal is then about.
  upload: boolean
) {
  const now = yield* DateTime.now;

  if (response.status === 429) {
    const wait = retryAfterOf(response.headers, now);

    return yield* Option.isSome(wait)
      ? new RateLimited({ retryAfter: wait.value })
      : new RateLimited();
  }

  const own = yield* devtoErrorOf(response);

  if (response.status >= 500 || Option.isNone(own)) {
    return yield* new PlatformUnavailable();
  }

  if (response.status === 401) {
    return yield* new TokenRejected();
  }

  const code = codeFor(response.status);

  return yield* upload || response.status === 413
    ? new MediaRejected({ code })
    : new BadRequest({ code });
});

const guardRefusalOf = (refused: OutboundRequestRefused) =>
  refused.reason === "lookupFailed"
    ? new PlatformUnavailable()
    : new BadRequest({ code: ownRefusalCodes.channelDisconnected });

const execute = (
  client: Client,
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  BadRequest | PlatformUnavailable
> =>
  client.execute(request).pipe(
    Effect.catchTags({
      HttpClientError: () => Effect.fail(new PlatformUnavailable()),
      OutboundRequestRefused: (refused) => Effect.fail(guardRefusalOf(refused)),
    })
  );

const answered =
  <A, I>(schema: Schema.Codec<A, I>, ok: readonly number[]) =>
  (response: HttpClientResponse.HttpClientResponse) =>
    ok.includes(response.status)
      ? HttpClientResponse.schemaBodyJson(schema)(response).pipe(
          Effect.mapError(() => new PlatformUnavailable())
        )
      : refusalOf(response, false);

/** What the article says, as `POST` and `PUT /api/articles` take it. */
interface ArticleFields {
  readonly body_markdown: string;
  readonly description: string;
  readonly main_image: string | null;
  readonly published?: boolean;
  readonly published_at?: string;
  readonly tags: readonly string[];
  readonly title: string;
}

// The post's address, when it is a web page's.
const webAddress = (link: string | null | undefined): string | undefined => {
  if (link === null || link === undefined || !URL.canParse(link)) {
    return undefined;
  }

  const { protocol } = new URL(link);

  return protocol === "https:" || protocol === "http:" ? link : undefined;
};

const published = (post: {
  readonly id: number;
  readonly url?: string | null;
}): PublishResult => {
  const permalink = webAddress(post.url);
  const platformPostId = PlatformPostIdSchema.make(String(post.id));

  return permalink === undefined
    ? { _tag: "published", platformPostId }
    : { _tag: "published", permalink, platformPostId };
};

const isoOf = (instant: DateTime.Utc) => DateTime.formatIso(instant);

// What the article says, as DEV takes it, its files where DEV has them.
const contentOf = (
  article: Article,
  addresses: ReadonlyMap<MediaAssetId, string>
): ArticleFields => {
  const { content } = article;

  return {
    body_markdown: articleMarkdown(content.body, addresses, "forem"),
    description: Option.getOrElse(content.excerpt, () => ""),
    main_image: Option.getOrNull(
      content.coverMediaId.pipe(
        Option.flatMap((cover) => Option.fromUndefinedOr(addresses.get(cover)))
      )
    ),
    tags: content.tags.map((tag) => tag.trim()),
    title: content.title.trim(),
  };
};

// How it lands: a draft, published now, or at its time, by DEV itself.
const statusOf = (article: Article) => {
  const { content, state } = article;

  if (content.siteStatus === "draft") {
    return { published: false };
  }

  return content.siteStatus === "future" && state._tag !== "draft"
    ? { published: true, published_at: isoOf(state.schedule.at) }
    : { published: true };
};

const signed = (
  token: SiteToken,
  request: HttpClientRequest.HttpClientRequest
) => request.pipe(withDevToKey(token.credential));

/** The calls to DEV, its API at `hosts`. */
export const devtoSiteAdapter = Effect.fnUntraced(function* devtoSiteAdapter(
  hosts: DevToHosts
) {
  const store = yield* ArticleStore;
  const journal = yield* ArticleJournal;
  const library = yield* MediaForPublishing;
  const api = yield* publicHttpClient;

  const listing = yield* publicHttpClientWith({
    maxResponseBytes: listingBytes,
    timeout: "1 minute",
  });

  const uploads = yield* publicHttpClientWith({ timeout: uploadTimeout });

  // When each channel's key last wrote, in this process: an article's
  // writes are one channel's turn at a time, so this spaces them all.
  const lastWrites = yield* Ref.make(new Map<string, number>());

  const spaced = <A, E, R>(token: SiteToken, write: Effect.Effect<A, E, R>) =>
    Effect.gen(function* spacedWrite() {
      const now = yield* Clock.currentTimeMillis;
      const last = (yield* Ref.get(lastWrites)).get(token.root);
      const wait = Duration.toMillis(writeSpacing);

      if (last !== undefined && now - last < wait) {
        yield* Effect.sleep(Duration.millis(wait - (now - last)));
      }

      const at = yield* Clock.currentTimeMillis;

      yield* Ref.update(lastWrites, (writes) =>
        new Map(writes).set(token.root, at)
      );

      return yield* write;
    });

  // Sends one file of the article: the address DEV serves it at.
  const upload = Effect.fn("DevToArticles.upload")(function* upload(
    token: SiteToken,
    article: Article,
    mediaId: MediaAssetId
  ) {
    const described = yield* library.describe(article.workspaceId, mediaId);

    return yield* Effect.scoped(
      Effect.gen(function* uploading() {
        const bytes = yield* library.held(article.workspaceId, mediaId);

        const form = multipartBody({
          boundary: formBoundary(`${article.id}-${mediaId}`),
          fields: [],
          file: {
            byteSize: described.byteSize,
            bytes,
            contentType: described.contentType,
            fileName: described.fileName,
            name: "image",
          },
        });

        return yield* spaced(
          token,
          execute(
            uploads,
            signed(
              token,
              HttpClientRequest.post(devtoUrl(hosts, "/api/images")).pipe(
                streamedBody(form.bytes, {
                  contentLength: form.contentLength,
                  contentType: form.contentType,
                })
              )
            )
          )
        ).pipe(
          Effect.flatMap((response) =>
            response.status === 201 || response.status === 200
              ? HttpClientResponse.schemaBodyJson(ImageSchema)(response).pipe(
                  Effect.mapError(() => new PlatformUnavailable())
                )
              : refusalOf(response, true)
          )
        );
      })
    );
  });

  // The addresses of the files the article shows, those sent before
  // reused, the others sent now; with `upload` false, those known only.
  const filesOf = Effect.fn("DevToArticles.filesOf")(function* filesOf(
    token: SiteToken,
    article: Article,
    { send }: { readonly send: boolean }
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

      const uploaded = yield* upload(token, article, mediaId);
      // DEV gives a file no id of its own: its address names it.
      const file: SiteFile = { id: 0, sourceUrl: uploaded.url };

      yield* journal
        .fileSent(article.id, mediaId, file)
        .pipe(Effect.mapError(() => new PlatformUnavailable()));

      addresses.set(mediaId, file.sourceUrl);
    }

    return { addresses, complete };
  });

  // The post this call made, looked for among the member's articles:
  // its title and its body, not another article's of the channel, and
  // published within the call's window when it is published.
  const lookUp = Effect.fn("DevToArticles.lookUp")(function* lookUp(
    token: SiteToken,
    article: Article,
    startedAt: DateTime.Utc
  ) {
    const { addresses, complete } = yield* filesOf(token, article, {
      send: false,
    });

    const expected = contentOf(article, addresses);
    const since = DateTime.subtractDuration(startedAt, clockSlack);
    const until = DateTime.addDuration(startedAt, searchWindow);
    const { state } = article;

    // A post DEV publishes itself says the time it was given.
    const scheduledAt =
      statusOf(article).published_at !== undefined && state._tag !== "draft"
        ? Option.some(state.schedule.at)
        : Option.none();

    const inWindow = (at: string | null | undefined) =>
      Option.fromNullishOr(at).pipe(
        Option.flatMap((written) => DateTime.make(written)),
        Option.exists(
          (when) =>
            DateTime.between(when, { maximum: until, minimum: since }) ||
            Option.exists(
              scheduledAt,
              (planned) =>
                Math.abs(
                  DateTime.toEpochMillis(when) - DateTime.toEpochMillis(planned)
                ) < 1000
            )
        )
      );

    const matching: (typeof ListedSchema.Type)[] = [];

    for (let page = 1; page <= maxSearchPages; page += 1) {
      const listed = yield* execute(
        listing,
        signed(
          token,
          HttpClientRequest.get(
            devtoUrl(hosts, "/api/articles/me/all", {
              page: String(page),
              per_page: String(searchPageSize),
            })
          )
        )
      ).pipe(Effect.flatMap(answered(Schema.Array(ListedSchema), [200])));

      matching.push(
        ...listed.filter(
          (post) =>
            post.title.trim() === expected.title &&
            // Its files' addresses known, the body says which post it is.
            (!complete ||
              (post.body_markdown ?? "").trim() ===
                expected.body_markdown.trim()) &&
            (post.published === true
              ? inWindow(post.published_at)
              : !statusOf(article).published)
        )
      );

      if (listed.length < searchPageSize) {
        break;
      }
    }

    const recorded = yield* store
      .recordedOn(
        article.channelId,
        matching.map((post) => String(post.id))
      )
      .pipe(Effect.orDie);

    const unclaimed = matching.filter((post) => !recorded.has(String(post.id)));
    const [only] = unclaimed;

    if (only === undefined) {
      const none: SiteSearch = { _tag: "none" };

      return none;
    }

    const search: SiteSearch =
      unclaimed.length > 1
        ? { _tag: "several" }
        : { _tag: "found", result: published(only) };

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

  const publish = Effect.fn("DevToArticles.publish")(function* publish(
    request: SitePublishRequest,
    article: Article,
    token: SiteToken
  ) {
    const { addresses } = yield* filesOf(token, article, { send: true });

    const fields: ArticleFields = {
      ...contentOf(article, addresses),
      ...statusOf(article),
    };

    // From here a run that stops looks for the post, never makes it.
    const committedAt = yield* request.committing.pipe(
      Effect.mapError(() => new PlatformUnavailable())
    );

    // The commit: once it may have reached DEV, nothing is sent again.
    const response = yield* spaced(
      token,
      api
        .execute(
          signed(
            token,
            HttpClientRequest.post(devtoUrl(hosts, "/api/articles")).pipe(
              HttpClientRequest.bodyJsonUnsafe({ article: fields })
            )
          )
        )
        .pipe(
          Effect.map(Option.some),
          Effect.catchTags({
            HttpClientError: () => Effect.succeedNone,
            OutboundRequestRefused: (refused) =>
              Effect.fail(guardRefusalOf(refused)),
          })
        )
    );

    if (Option.isNone(response) || response.value.status >= 500) {
      return yield* lookedUp(token, article, committedAt, "noResponse");
    }

    if (response.value.status !== 201 && response.value.status !== 200) {
      return yield* refusalOf(response.value, false);
    }

    const post = yield* HttpClientResponse.schemaBodyJson(CreatedSchema)(
      response.value
    ).pipe(Effect.option);

    return Option.isSome(post)
      ? published(post.value)
      : yield* lookedUp(token, article, committedAt, "unreadableResponse");
  });

  // A change of the article on DEV, its status left as it stands.
  const put = (
    token: SiteToken,
    platformPostId: string,
    fields: Partial<ArticleFields>
  ) =>
    spaced(
      token,
      execute(
        api,
        signed(
          token,
          HttpClientRequest.put(
            devtoUrl(
              hosts,
              `/api/articles/${encodeURIComponent(platformPostId)}`
            )
          ).pipe(HttpClientRequest.bodyJsonUnsafe({ article: fields }))
        )
      )
    );

  const update = Effect.fn("DevToArticles.update")(function* update(
    article: Article,
    platformPostId: string,
    token: SiteToken
  ) {
    const { addresses } = yield* filesOf(token, article, { send: true });

    const response = yield* put(
      token,
      platformPostId,
      contentOf(article, addresses)
    );

    return yield* response.status === 200
      ? Effect.void
      : refusalOf(response, false);
  });

  // DEV deletes no article: unpublished, it is a draft there again. One
  // gone already is done.
  const remove = Effect.fn("DevToArticles.remove")(function* remove(
    _article: Article,
    platformPostId: string,
    token: SiteToken
  ) {
    const response = yield* put(token, platformPostId, { published: false });

    return yield* response.status === 200 || response.status === 404
      ? Effect.void
      : refusalOf(response, false);
  });

  const adapter: SiteAdapter = {
    find: (request, article, token) =>
      lookUp(token, article, request.startedAt),
    publish,
    remove,
    resume: (request, article, token) =>
      lookedUp(token, article, request.startedAt, "interrupted"),
    update,
  };

  return adapter;
});
