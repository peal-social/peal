import { Effect, Layer, Option } from "effect";

import { ArticleStore } from "#publishing/application/article-store.ts";
import { SiteCredentials } from "#publishing/application/site-credentials.ts";
import type { SiteToken } from "#publishing/application/site-credentials.ts";
import { SitePublisher } from "#publishing/application/site-publisher.ts";
import type { SitePublishRequest } from "#publishing/application/site-publisher.ts";
import type { Article } from "#publishing/domain/article.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import type { SiteAdapter } from "#publishing/infrastructure/platforms/site-adapter.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import type { SitePlatform } from "#shared/domain/platform.ts";

/** Each kind of website's calls, by the platform its channels name. */
export type SiteAdapters = Readonly<Record<SitePlatform, SiteAdapter>>;

// Peal's own refusal for an article it cannot read any more.
const articleGone = new BadRequest({
  code: ownRefusalCodes.channelDisconnected,
});

/**
 * SitePublisher over every kind of website: the article read, its
 * channel's credential taken from the channels context (which marks the
 * channel to reconnect when the site refuses it), and the call made by
 * the adapter of the platform the channel connects.
 */
export const routedSitePublisher = <E, R>(
  adapters: Effect.Effect<SiteAdapters, E, R>
) =>
  Layer.effect(
    SitePublisher,
    Effect.gen(function* RoutedSitePublisher() {
      const store = yield* ArticleStore;
      const credentials = yield* SiteCredentials;
      const byPlatform = yield* adapters;

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

      // The call, with the channel's credential, by its site's adapter.
      const onSite = <A, F>(
        article: Article,
        call: (adapter: SiteAdapter, token: SiteToken) => Effect.Effect<A, F>
      ) =>
        credentials.withToken(article.channelId, (token) =>
          call(byPlatform[token.platform], token)
        );

      const requested =
        <A, F>(
          call: (
            adapter: SiteAdapter,
            request: SitePublishRequest,
            article: Article,
            token: SiteToken
          ) => Effect.Effect<A, F>
        ) =>
        (request: SitePublishRequest) =>
          articleOf(request.articleId).pipe(
            Effect.flatMap((article) =>
              onSite(article, (adapter, token) =>
                call(adapter, request, article, token)
              )
            )
          );

      return SitePublisher.of({
        find: requested((adapter, request, article, token) =>
          adapter.find(request, article, token)
        ),
        publish: requested((adapter, request, article, token) =>
          adapter.publish(request, article, token)
        ),
        remove: (article, platformPostId) =>
          onSite(article, (adapter, token) =>
            adapter.remove(article, platformPostId, token)
          ),
        resume: requested((adapter, request, article, token) =>
          adapter.resume(request, article, token)
        ),
        update: (article, platformPostId) =>
          onSite(article, (adapter, token) =>
            adapter.update(article, platformPostId, token)
          ),
      });
    })
  );
