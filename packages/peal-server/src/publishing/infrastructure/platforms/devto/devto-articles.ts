import {
  Clock,
  DateTime,
  Duration,
  Effect,
  Option,
  Ref,
  Schema,
  Semaphore,
} from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

import { MediaForPublishing } from "#publishing/application/media-for-publishing.ts";
import type { SiteAdapter } from "#publishing/application/site-calls.ts";
import type {
  SiteCallJournal,
  SiteFile,
  SiteFileJournal,
} from "#shared/application/site-call-journal.ts";
import type { SiteSearch } from "#shared/application/site-search.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
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
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";
import { articleMarkdown } from "#shared/domain/rich-text/rich-body-markdown.ts";
import { siteArticleMediaOf } from "#shared/domain/rich-text/site-article-content.ts";
import { siteRefusalCodes } from "#shared/domain/rich-text/site-refusal-codes.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  devtoErrorOf,
  devtoUrl,
  withDevToKey,
} from "#shared/infrastructure/platforms/devto-api.ts";
import type { DevToHosts } from "#shared/infrastructure/platforms/devto-api.ts";
import {
  randomBoundary,
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
// commit: `title`, `body_markdown` (written by `rich-body-markdown.ts`),
// `description`, `tags`, `main_image`, and `published` (false for a
// draft; true with a future `published_at`, which DEV publishes itself
// then). DEV takes the title and the description as plain text, and
// escapes them itself (and rewrites a title: `normalize_title`). It
// keeps no idempotency key: a post whose answer was lost is looked for
// among the member's drafts, published articles, or all for one DEV
// publishes itself, by its body, which DEV keeps as sent, and adopted
// only when exactly one, not another article's, matches; one of the
// title (by its letters and digits) with another body is never sent
// again. `PUT /api/articles/{id}` sends it again; DEV has no way to
// delete an article, so unpublishing makes it a draft there
// (`published` false). DEV takes one write a second from an address:
// every write of the process goes one at a time, and a short
// `Retry-After` is waited out in place. A time "scheduled there" that has
// gone by is left out, as DEV refuses one past.

// Uploads take longer than the API's calls.
const uploadTimeout = Duration.minutes(10);

// A listing carries each article's Markdown, up to 800 KB each.
const listingBytes = 32 * 1024 * 1024;

// DEV's limit on writes with one key (Rack::Attack's, per second).
const writeSpacing = Duration.millis(1100);

// A refusal for coming too soon that asks to wait this long at most is
// waited out in place, a few times; a longer one ends the attempt.
const shortWaitLimit = Duration.seconds(5);

const maxShortWaits = 3;

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
    : new BadRequest({ code: siteRefusalCodes.channelDisconnected });

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
  article: OutgoingArticle,
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

// When DEV is to publish it itself, as "scheduled there": none for a
// draft or an article published at once.
const plannedAt = (article: OutgoingArticle) =>
  article.content.siteStatus === "draft"
    ? Option.none<DateTime.Utc>()
    : article.publishAt;

// How it lands: a draft, published now, or at its time, by DEV itself. A
// time gone by is left out: DEV refuses one more than 15 minutes past
// (`future_or_current_published_at`), and publishes it now without one.
const statusOf = (article: OutgoingArticle, now: DateTime.Utc) => {
  if (article.content.siteStatus === "draft") {
    return { published: false };
  }

  return Option.match(
    plannedAt(article).pipe(
      Option.filter((at) => DateTime.isGreaterThan(at, now))
    ),
    {
      onNone: () => ({ published: true }),
      onSome: (at) => ({ published: true, published_at: isoOf(at) }),
    }
  );
};

// Where DEV lists an article: a draft among the drafts, a post published
// now among the published ones (newest first, past any number of
// drafts), one DEV publishes itself among all.
const listingOf = (draft: boolean, scheduled: boolean) => {
  if (draft) {
    return "/api/articles/me/unpublished";
  }

  return scheduled ? "/api/articles/me/all" : "/api/articles/me/published";
};

// What of a title DEV keeps whatever it does to it: its letters and
// digits. Forem's `normalize_title` makes a space of what it does not
// allow, which is never a letter or a digit, and runs spaces together.
// A title of signs alone keeps its signs, compared as written.
const titleKey = (title: string) => {
  const key = title.replaceAll(/[^\p{L}\p{N}]/gu, "");

  return key === "" ? title.trim() : key;
};

const signed = (
  token: SiteToken,
  request: HttpClientRequest.HttpClientRequest
) => request.pipe(withDevToKey(token.credential));

/** The calls to DEV, its API at `hosts`. */
export const devtoSiteAdapter = Effect.fnUntraced(function* devtoSiteAdapter(
  hosts: DevToHosts
) {
  const library = yield* MediaForPublishing;
  const api = yield* publicHttpClient;

  const listing = yield* publicHttpClientWith({
    maxResponseBytes: listingBytes,
    timeout: "1 minute",
  });

  const uploads = yield* publicHttpClientWith({ timeout: uploadTimeout });

  // DEV takes one write a second from an address, whatever key it
  // carries (Rack::Attack's `api_write_throttle`, counted as requests
  // arrive): every write to DEV in the process goes one at a time, a
  // second and a little after the one before ended.
  const writes = yield* Semaphore.make(1);
  const nextWrite = yield* Ref.make(0);

  const slot = Effect.gen(function* slot() {
    const now = yield* Clock.currentTimeMillis;
    const at = yield* Ref.get(nextWrite);

    if (at > now) {
      yield* Effect.sleep(Duration.millis(at - now));
    }
  });

  const ended = Effect.gen(function* ended() {
    const now = yield* Clock.currentTimeMillis;

    yield* Ref.update(nextWrite, (next) =>
      Math.max(next, now + Duration.toMillis(writeSpacing))
    );
  });

  // A write in its slot; one DEV refused for coming too soon, with a
  // short `Retry-After`, waits it out, holding nothing, and goes again
  // (nothing was made). A short write holds the process's turn to its
  // end; an upload, which may take minutes, only to its start, so the
  // writes made in a member's request (an update, an unpublish) never
  // wait behind one.
  const paced = <E, R>(
    write: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>,
    long: boolean
  ) =>
    Effect.gen(function* spacedWrite() {
      for (let tries = 1; ; tries += 1) {
        const response = long
          ? yield* slot.pipe(
              Effect.andThen(ended),
              writes.withPermits(1),
              Effect.andThen(write.pipe(Effect.ensuring(ended)))
            )
          : yield* slot.pipe(
              Effect.andThen(write.pipe(Effect.ensuring(ended))),
              writes.withPermits(1)
            );

        const now = yield* DateTime.now;

        const wait = retryAfterOf(response.headers, now).pipe(
          Option.map(Duration.toMillis)
        );

        const shortWait =
          response.status === 429 &&
          tries < maxShortWaits &&
          Option.exists(
            wait,
            (millis) => millis <= Duration.toMillis(shortWaitLimit)
          );

        if (!shortWait) {
          return response;
        }

        yield* Effect.sleep(Duration.millis(Option.getOrElse(wait, () => 0)));
      }
    });

  const spaced = <E, R>(
    write: Effect.Effect<HttpClientResponse.HttpClientResponse, E, R>
  ) => paced(write, false);

  // Sends one file of the article: the address DEV serves it at.
  const upload = Effect.fn("DevToArticles.upload")(function* upload(
    token: SiteToken,
    article: OutgoingArticle,
    mediaId: MediaAssetId
  ) {
    const described = yield* library.describe(article.workspaceId, mediaId);

    return yield* Effect.scoped(
      Effect.gen(function* uploading() {
        const bytes = yield* library.held(article.workspaceId, mediaId);

        const form = multipartBody({
          boundary: randomBoundary(),
          fields: [],
          file: {
            byteSize: described.byteSize,
            bytes,
            contentType: described.contentType,
            fileName: described.fileName,
            name: "image",
          },
        });

        return yield* paced(
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
          ),
          true
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
    article: OutgoingArticle,
    journal: SiteFileJournal,
    { send }: { readonly send: boolean }
  ) {
    const sent = yield* journal.filesSent.pipe(
      Effect.mapError(() => new PlatformUnavailable())
    );

    const addresses = new Map<MediaAssetId, string>();
    let complete = true;

    for (const mediaId of new Set(siteArticleMediaOf(article.content))) {
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
        .fileSent(mediaId, file)
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
    article: OutgoingArticle,
    journal: SiteFileJournal,
    startedAt: DateTime.Utc
  ) {
    const { addresses, complete } = yield* filesOf(token, article, journal, {
      send: false,
    });

    const expected = contentOf(article, addresses);
    const since = DateTime.subtractDuration(startedAt, clockSlack);
    const until = DateTime.addDuration(startedAt, searchWindow);
    const draft = article.content.siteStatus === "draft";

    // A post DEV publishes itself says the time it was given.
    const scheduledAt = plannedAt(article);

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

    const listed = listingOf(draft, Option.isSome(scheduledAt));

    const candidates: (typeof ListedSchema.Type)[] = [];

    for (let page = 1; page <= maxSearchPages; page += 1) {
      const posts = yield* execute(
        listing,
        signed(
          token,
          HttpClientRequest.get(
            devtoUrl(hosts, listed, {
              page: String(page),
              per_page: String(searchPageSize),
            })
          )
        )
      ).pipe(Effect.flatMap(answered(Schema.Array(ListedSchema), [200])));

      candidates.push(
        ...posts.filter((post) =>
          post.published === true
            ? !draft && inWindow(post.published_at)
            : draft
        )
      );

      if (posts.length < searchPageSize) {
        break;
      }
    }

    const recorded = yield* journal
      .recordedOn(candidates.map((post) => String(post.id)))
      .pipe(Effect.orDie);

    const unclaimed = candidates.filter(
      (post) => !recorded.has(String(post.id))
    );

    const titled = unclaimed.filter(
      (post) => titleKey(post.title) === titleKey(expected.title)
    );

    // DEV keeps the body as it was sent: with every file's address known,
    // the body says which post it is. One of the title with another body
    // may be it, rewritten there, or another: no one can tell, and it is
    // never sent again.
    const matching = complete
      ? unclaimed.filter(
          (post) =>
            (post.body_markdown ?? "").trim() === expected.body_markdown.trim()
        )
      : titled;

    const [only] = matching;

    if (only !== undefined) {
      const found: SiteSearch =
        matching.length > 1
          ? { _tag: "several" }
          : { _tag: "found", result: published(only) };

      return found;
    }

    const search: SiteSearch =
      titled.length > 0 ? { _tag: "several" } : { _tag: "none" };

    return search;
  });

  const lookedUp = (
    token: SiteToken,
    article: OutgoingArticle,
    journal: SiteFileJournal,
    startedAt: DateTime.Utc,
    reason: UnconfirmedReason
  ) =>
    lookUp(token, article, journal, startedAt).pipe(
      Effect.map((search): PublishResult =>
        search._tag === "found"
          ? search.result
          : {
              _tag: "unconfirmed",
              // Several posts the call may have made: the member is told so.
              reason: search._tag === "several" ? "severalOnSite" : reason,
            }
      ),
      Effect.catchTag(
        ["PlatformUnavailable", "RateLimited", "BadRequest", "MediaRejected"],
        (): Effect.Effect<PublishResult> =>
          Effect.succeed({ _tag: "unconfirmed", reason })
      )
    );

  const publish = Effect.fn("DevToArticles.publish")(function* publish(
    article: OutgoingArticle,
    journal: SiteCallJournal,
    token: SiteToken
  ) {
    const { addresses } = yield* filesOf(token, article, journal, {
      send: true,
    });

    const fields: ArticleFields = {
      ...contentOf(article, addresses),
      ...statusOf(article, yield* DateTime.now),
    };

    // From here a run that stops looks for the post, never makes it.
    const committedAt = yield* journal.committing.pipe(
      Effect.mapError(() => new PlatformUnavailable())
    );

    // The commit: once it may have reached DEV, nothing is sent again.
    const response = yield* spaced(
      api.execute(
        signed(
          token,
          HttpClientRequest.post(devtoUrl(hosts, "/api/articles")).pipe(
            HttpClientRequest.bodyJsonUnsafe({ article: fields })
          )
        )
      )
    ).pipe(
      Effect.map(Option.some),
      Effect.catchTags({
        HttpClientError: () => Effect.succeedNone,
        OutboundRequestRefused: (refused) =>
          Effect.fail(guardRefusalOf(refused)),
      })
    );

    if (Option.isNone(response) || response.value.status >= 500) {
      return yield* lookedUp(
        token,
        article,
        journal,
        committedAt,
        "noResponse"
      );
    }

    if (response.value.status !== 201 && response.value.status !== 200) {
      return yield* refusalOf(response.value, false);
    }

    const post = yield* HttpClientResponse.schemaBodyJson(CreatedSchema)(
      response.value
    ).pipe(Effect.option);

    return Option.isSome(post)
      ? published(post.value)
      : yield* lookedUp(
          token,
          article,
          journal,
          committedAt,
          "unreadableResponse"
        );
  });

  // A change of the article on DEV, its status left as it stands.
  const put = (
    token: SiteToken,
    platformPostId: string,
    fields: Partial<ArticleFields>
  ) =>
    spaced(
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
    article: OutgoingArticle,
    journal: SiteFileJournal,
    platformPostId: string,
    token: SiteToken
  ) {
    const { addresses } = yield* filesOf(token, article, journal, {
      send: true,
    });

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
    platformPostId: string,
    token: SiteToken
  ) {
    const response = yield* put(token, platformPostId, { published: false });

    return yield* response.status === 200 || response.status === 404
      ? Effect.void
      : refusalOf(response, false);
  });

  const adapter: SiteAdapter = {
    find: (request, article, journal, token) =>
      lookUp(token, article, journal, request.startedAt),
    publish,
    remove,
    resume: (request, article, journal, token) =>
      lookedUp(token, article, journal, request.startedAt, "interrupted"),
    update,
  };

  return adapter;
});
