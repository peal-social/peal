import { siteRefusalCodes } from "#shared/domain/rich-text/site-refusal-codes.ts";

/**
 * The codes of the refusals of an article that its failure reason reads as
 * Peal's own, rather than the site's: Peal could not use the website's
 * channel or a file, the workspace's plan had no room, or the site's own
 * plan refuses its API. They are stored in the journal and in the
 * article's state, so never change one. Any other code is the site's, and
 * the article fails as `contentRejected` or `mediaRejected` with it.
 */
export const articleRefusalCodes = {
  // A BadRequest: the channel is turned off.
  channelDisabled: "channelDisabled",
  // A BadRequest: the channel is no longer connected to the workspace, or
  // the article is gone from Peal. The site adapters' own.
  channelDisconnected: siteRefusalCodes.channelDisconnected,
  // A MediaRejected: the file was deleted, or is no longer ready. The
  // library's adapter (`LibraryMediaForPublishing`) writes it, for posts
  // and articles alike: it must stay the posts' own code.
  mediaRemoved: "mediaUnavailable",
  // A BadRequest: the workspace's plan has no room for the article when it
  // is due, as after a trial or on a smaller plan.
  planLimit: "planLimit",
  // A BadRequest: the site's API refuses the account until its plan is
  // paid for (Hashnode: every request needs its Pro plan on the
  // publication). Nothing was sent; the article fails as `contentRejected`
  // with this code, which tells the member what to do. The site adapters'
  // own.
  sitePlanRequired: siteRefusalCodes.sitePlanRequired,
} as const;
