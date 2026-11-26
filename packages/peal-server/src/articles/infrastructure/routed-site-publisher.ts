import { Effect, Layer, Option } from "effect";
import type { DateTime } from "effect";

import { ArticleJournal } from "#articles/application/article-journal.ts";
import { ArticleStore } from "#articles/application/article-store.ts";
import { SiteCredentials } from "#articles/application/site-credentials.ts";
import { SitePublisher } from "#articles/application/site-publisher.ts";
import type { SitePublishRequest } from "#articles/application/site-publisher.ts";
import { articleRefusalCodes } from "#articles/domain/article-refusals.ts";
import type { Article } from "#articles/domain/article.ts";
import { SiteCalls } from "#publishing/application/site-calls.ts";
import type { SiteAdapter } from "#publishing/application/site-calls.ts";
import type {
  SiteCallJournal,
  SiteFileJournal,
} from "#shared/application/site-call-journal.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";

// Peal's own refusal for an article it cannot read any more.
const articleGone = new BadRequest({
  code: articleRefusalCodes.channelDisconnected,
});

/**
 * The article as its site gets it: what it says, and its time when the
 * site publishes it itself (`future`), once it is scheduled.
 */
const outgoingOf = (article: Article): OutgoingArticle => {
  const { content, state } = article;

  const publishAt: Option.Option<DateTime.Utc> =
    content.siteStatus === "future" && state._tag !== "draft"
      ? Option.some(state.schedule.at)
      : Option.none();

  return {
    channelId: article.channelId,
    content,
    publishAt,
    workspaceId: article.workspaceId,
  };
};

/**
 * SitePublisher over every kind of website: the article read, its
 * channel's credential taken from the channels context (which marks the
 * channel to reconnect when the site refuses it), and the call made by
 * publishing's site calls (SiteCalls, the adapter of the platform the
 * credential names), with the article's journal: the files its site
 * took, and the posts the channel's articles are recorded to have made.
 */
export const RoutedSitePublisher = Layer.effect(
  SitePublisher,
  Effect.gen(function* RoutedSitePublisher() {
    const store = yield* ArticleStore;
    const journal = yield* ArticleJournal;
    const credentials = yield* SiteCredentials;
    const siteCalls = yield* SiteCalls;

    const articleOf = (articleId: SitePublishRequest["articleId"]) =>
      store.get(articleId).pipe(
        Effect.orDie,
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(articleGone),
            onSome: Effect.succeed,
          })
        )
      );

    // What a change of the article's post needs of its journal.
    const filesOf = (article: Article): SiteFileJournal => ({
      featuredRefused: (mediaId) =>
        journal.featuredRefused(article.id, mediaId),
      fileSent: (mediaId, file) => journal.fileSent(article.id, mediaId, file),
      filesSent: journal.filesSent(article.id),
      forgetFile: (mediaId) => journal.forgetFile(article.id, mediaId),
      recordedOn: (platformPostIds) =>
        store.recordedOn(article.channelId, platformPostIds),
    });

    // What an attempt's call needs of it: the commit mark too.
    const callOf = (
      article: Article,
      request: SitePublishRequest
    ): SiteCallJournal => ({
      ...filesOf(article),
      committing: request.committing,
    });

    // The call, with the channel's credential, by its site's adapter.
    const onSite = <A, F>(
      article: Article,
      call: (adapter: SiteAdapter, token: SiteToken) => Effect.Effect<A, F>
    ) =>
      credentials.withToken(article.channelId, (token) =>
        call(siteCalls, token)
      );

    const requested =
      <A, F>(
        call: (
          adapter: SiteAdapter,
          request: SitePublishRequest,
          article: OutgoingArticle,
          calls: SiteCallJournal,
          token: SiteToken
        ) => Effect.Effect<A, F>
      ) =>
      (request: SitePublishRequest) =>
        articleOf(request.articleId).pipe(
          Effect.flatMap((article) =>
            onSite(article, (adapter, token) =>
              call(
                adapter,
                request,
                outgoingOf(article),
                callOf(article, request),
                token
              )
            )
          )
        );

    return SitePublisher.of({
      find: requested((adapter, request, article, calls, token) =>
        adapter.find(request, article, calls, token)
      ),
      publish: requested((adapter, _request, article, calls, token) =>
        adapter.publish(article, calls, token)
      ),
      remove: (article, platformPostId) =>
        onSite(article, (adapter, token) =>
          adapter.remove(platformPostId, token)
        ),
      resume: requested((adapter, request, article, calls, token) =>
        adapter.resume(request, article, calls, token)
      ),
      update: (article, platformPostId) =>
        onSite(article, (adapter, token) =>
          adapter.update(
            outgoingOf(article),
            filesOf(article),
            platformPostId,
            token
          )
        ),
    });
  })
);
