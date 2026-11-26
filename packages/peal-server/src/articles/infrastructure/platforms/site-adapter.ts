import type { Effect } from "effect";

import type { SiteToken } from "#articles/application/site-credentials.ts";
import type {
  SitePublishRequest,
  SiteSearch,
} from "#articles/application/site-publisher.ts";
import type { Article } from "#articles/domain/article.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type { PublishResult } from "#shared/domain/publish-result.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

/**
 * One kind of website's calls, as `SitePublisher` makes them: the article
 * read and the channel's credential in hand. Each answers as the port
 * says (published, refused, unconfirmed; never a second post of a call
 * that may have reached the site), and fails with `TokenRejected` when
 * the site refused the credential itself, which marks the channel to
 * reconnect.
 */
export interface SiteAdapter {
  readonly publish: (
    request: SitePublishRequest,
    article: Article,
    token: SiteToken
  ) => Effect.Effect<PublishResult, PublishFailure | TokenRejected>;
  readonly resume: (
    request: SitePublishRequest,
    article: Article,
    token: SiteToken
  ) => Effect.Effect<PublishResult, PublishFailure | TokenRejected>;
  readonly find: (
    request: SitePublishRequest,
    article: Article,
    token: SiteToken
  ) => Effect.Effect<SiteSearch, PublishFailure | TokenRejected>;
  readonly remove: (
    article: Article,
    platformPostId: string,
    token: SiteToken
  ) => Effect.Effect<void, PublishFailure | TokenRejected>;
  readonly update: (
    article: Article,
    platformPostId: string,
    token: SiteToken
  ) => Effect.Effect<void, PublishFailure | TokenRejected>;
}
