import type { Effect } from "effect";

import type { SiteToken } from "#articles/application/site-credentials.ts";
import type { SiteSearch } from "#articles/application/site-publisher.ts";
import type {
  SiteCallJournal,
  SiteCallRequest,
  SiteFileJournal,
} from "#shared/application/site-call-journal.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type { PublishResult } from "#shared/domain/publish-result.ts";
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

/**
 * One kind of website's calls, given the article as the site gets it, the
 * journal of whoever sends it and the channel's credential. Each answers
 * as `SitePublisher` says (published, refused, unconfirmed; never a
 * second post of a call that may have reached the site), and fails with
 * `TokenRejected` when the site refused the credential itself, which
 * marks the channel to reconnect.
 */
export interface SiteAdapter {
  readonly publish: (
    request: SiteCallRequest,
    article: OutgoingArticle,
    journal: SiteCallJournal,
    token: SiteToken
  ) => Effect.Effect<PublishResult, PublishFailure | TokenRejected>;
  readonly resume: (
    request: SiteCallRequest,
    article: OutgoingArticle,
    journal: SiteCallJournal,
    token: SiteToken
  ) => Effect.Effect<PublishResult, PublishFailure | TokenRejected>;
  readonly find: (
    request: SiteCallRequest,
    article: OutgoingArticle,
    journal: SiteCallJournal,
    token: SiteToken
  ) => Effect.Effect<SiteSearch, PublishFailure | TokenRejected>;
  readonly remove: (
    platformPostId: string,
    token: SiteToken
  ) => Effect.Effect<void, PublishFailure | TokenRejected>;
  readonly update: (
    article: OutgoingArticle,
    journal: SiteFileJournal,
    platformPostId: string,
    token: SiteToken
  ) => Effect.Effect<void, PublishFailure | TokenRejected>;
}
