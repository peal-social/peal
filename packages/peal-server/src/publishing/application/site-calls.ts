import { Context } from "effect";
import type { Effect } from "effect";

import type {
  SiteCallJournal,
  SiteCallRequest,
  SiteFileJournal,
} from "#shared/application/site-call-journal.ts";
import type { SiteSearch } from "#shared/application/site-search.ts";
import type { SiteToken } from "#shared/application/site-token.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type { PublishResult } from "#shared/domain/publish-result.ts";
import type { OutgoingArticle } from "#shared/domain/rich-text/outgoing-article.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";

/**
 * One kind of website's calls, given the article as the site gets it, the
 * journal of whoever sends it and the channel's credential. Each answers
 * as a publication does (published, refused, unconfirmed; never a second
 * post of a call that may have reached the site), and fails with
 * `TokenRejected` when the site refused the credential itself, which
 * marks the channel to reconnect.
 */
export interface SiteAdapter {
  readonly publish: (
    article: OutgoingArticle,
    journal: SiteCallJournal,
    token: SiteToken
  ) => Effect.Effect<PublishResult, PublishFailure | TokenRejected>;
  /**
   * An earlier run of the attempt began the call and stopped after its
   * commit mark: the site is searched for the post, which is never made
   * again; one Peal cannot find is unconfirmed.
   */
  readonly resume: (
    request: SiteCallRequest,
    article: OutgoingArticle,
    journal: SiteFileJournal,
    token: SiteToken
  ) => Effect.Effect<PublishResult, PublishFailure | TokenRejected>;
  /**
   * Looks for the post a call made at `startedAt`, among the site's made
   * or changed then, never making one: it, none, or several.
   */
  readonly find: (
    request: SiteCallRequest,
    article: OutgoingArticle,
    journal: SiteFileJournal,
    token: SiteToken
  ) => Effect.Effect<SiteSearch, PublishFailure | TokenRejected>;
  /** Takes the post down from the site (WordPress's trash, DEV a draft). */
  readonly remove: (
    platformPostId: string,
    token: SiteToken
  ) => Effect.Effect<void, PublishFailure | TokenRejected>;
  /** Sends the article's content again over its post on the site. */
  readonly update: (
    article: OutgoingArticle,
    journal: SiteFileJournal,
    platformPostId: string,
    token: SiteToken
  ) => Effect.Effect<void, PublishFailure | TokenRejected>;
}

/**
 * The websites' calls, by the platform the credential names: what
 * publishing's site client makes for posts, and what the articles
 * context's publisher makes for articles, through this port alone (an
 * adapter of one context calls another's application layer). Each takes
 * the caller's journal, so a post's calls keep publishing's and an
 * article's the articles'.
 */
export class SiteCalls extends Context.Service<SiteCalls, SiteAdapter>()(
  "peal-server/publishing/application/SiteCalls"
) {}
