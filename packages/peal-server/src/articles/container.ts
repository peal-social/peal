import { Layer } from "effect";

import { ArticleRecords } from "#articles/application/article-records.ts";
import { Articles } from "#articles/application/articles.ts";
import { MediaInArticles } from "#articles/application/media-in-articles.ts";
import { ChannelAccessSiteCredentials } from "#articles/infrastructure/channel-access-site-credentials.ts";
import {
  DrizzleArticleJournal,
  DrizzleArticleStore,
} from "#articles/infrastructure/drizzle-article-store.ts";
import { LibraryArticleMedia } from "#articles/infrastructure/library-article-media.ts";
import { ListedSiteChannels } from "#articles/infrastructure/listed-site-channels.ts";
import { PostingArticleGates } from "#articles/infrastructure/posting-article-gates.ts";
import { RoutedSitePublisher } from "#articles/infrastructure/routed-site-publisher.ts";
import { SqlArticleSendTurns } from "#articles/infrastructure/sql-article-send-turns.ts";
import { WebhookArticleEvents } from "#articles/infrastructure/webhook-article-events.ts";
import { WorkflowArticleJobs } from "#articles/infrastructure/workflow-article-jobs.ts";
import { PublishArticleV1Live } from "#articles/infrastructure/workflows/publish-article.ts";

// The websites articles go to: WordPress sites, on WordPress.com too,
// DEV and Hashnode, with the tokens the channels context hands out,
// through publishing's site calls (SiteCalls), which the composition root
// brings with what posts go out under (`PostingServicesLive`).
const SitePublisherLive = RoutedSitePublisher.pipe(
  Layer.provide(
    Layer.mergeAll(
      ChannelAccessSiteCredentials,
      DrizzleArticleStore,
      DrizzleArticleJournal
    )
  )
);

/**
 * The articles' use cases (`Articles`), for the handlers, and their
 * records (`ArticleRecords`), for the workspace context's exports and
 * erasures: on the channels of websites the channels context lists, with
 * the files its library holds, sent by `PublishArticleV1` jobs, within the
 * workspace's plan. Needs the database, the workflow engine, a
 * TransactionRunner, Ids, Dns, ListChannels and ChannelAccess, and what
 * articles go out under, from publishing (`PostingServicesLive`: its
 * AttachableMedia, PostAllowance and MediaForPublishing) and the
 * ApprovalGate.
 */
export const ArticlesLive = Layer.merge(
  Articles.layer,
  ArticleRecords.layer
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DrizzleArticleStore,
      DrizzleArticleJournal,
      WorkflowArticleJobs,
      ListedSiteChannels,
      LibraryArticleMedia,
      PostingArticleGates,
      SitePublisherLive
    )
  )
);

/**
 * The job that sends articles to their sites (`PublishArticleV1`), whose
 * endings the workspace's webhook endpoints hear. Needs the cluster and
 * what ArticlesLive needs, with WebhookEvents and ChannelRepository.
 */
export const ArticleWorkersLive = PublishArticleV1Live.pipe(
  Layer.provide(
    Layer.mergeAll(
      SqlArticleSendTurns,
      DrizzleArticleStore,
      DrizzleArticleJournal,
      WebhookArticleEvents,
      PostingArticleGates,
      SitePublisherLive
    )
  )
);

/**
 * Which articles show a file of the library, for the media context to ask
 * before it deletes one (MediaInArticles), after the posts in its
 * transaction. Needs the database (Drizzle).
 */
export const MediaInArticlesLive = MediaInArticles.layer.pipe(
  Layer.provide(DrizzleArticleStore)
);

// The articles endpoints, behind the Authentication and WorkspaceAccess
// middleware of the workspace context, which the composition root brings.
export { ArticlesHandlers as ArticlesApiLive } from "#articles/api/articles.ts";
