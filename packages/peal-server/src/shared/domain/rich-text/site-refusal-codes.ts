/**
 * The codes a website's adapter refuses a call with that are Peal's own,
 * not the site's. They are stored in journals and states, so never change
 * one.
 */
export const siteRefusalCodes = {
  // A BadRequest: Peal cannot reach the site any more (the outbound guard
  // refused its address for good), as when the channel is no longer
  // connected.
  channelDisconnected: "channelDisconnected",
  // A BadRequest: the site's API refuses the account until its plan is
  // paid for (Hashnode: every request needs its Pro plan on the
  // publication). Nothing was sent.
  sitePlanRequired: "sitePlanRequired",
} as const;
