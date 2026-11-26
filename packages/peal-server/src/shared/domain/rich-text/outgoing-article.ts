import type { DateTime, Option } from "effect";

import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";

import type { SiteArticleContent } from "./site-article-content.ts";

/** An article as a site gets it, whoever asks. */
export interface OutgoingArticle {
  /** The website's channel it goes to. */
  readonly channelId: ChannelId;
  /** Whose library its files are read from. */
  readonly workspaceId: WorkspaceId;
  readonly content: SiteArticleContent;
  /**
   * When the site is to publish it itself (`future`), Peal sending it
   * ahead; none for an article the site publishes as it gets it.
   */
  readonly publishAt: Option.Option<DateTime.Utc>;
}
