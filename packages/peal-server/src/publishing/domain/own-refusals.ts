/**
 * The codes of the refusals Peal makes itself, before any platform is
 * called: the post's channel or one of its media can no longer be used, or
 * the workspace's plan has no room for it.
 * They are stored in the publication journal, so never change one. The
 * publication policy tells them apart from the platforms' own codes.
 */
export const ownRefusalCodes = {
  // A BadRequest: the channel is turned off.
  channelDisabled: "channelDisabled",
  // A BadRequest: the channel is no longer connected to the workspace.
  channelDisconnected: "channelDisconnected",
  // A MediaRejected: the media was deleted, or is no longer ready.
  mediaRemoved: "mediaUnavailable",
  // A BadRequest: a part after the first on a platform that takes a post
  // alone. Scheduling refuses it: this is the router's last check.
  partsNotSupported: "partsNotSupported",
  // A BadRequest: the platform bills each post, passed through to the
  // billing account (X), which has no payment method: nothing was sent.
  paymentMethodRequired: "paymentMethodRequired",
  // A BadRequest: the same, but the billing account's last payment failed:
  // nothing past what is included until it goes through. Nothing was sent.
  paymentFailed: "paymentFailed",
  // A BadRequest: the same, but the account is on a plan from before
  // per-account pricing, which bills no use: nothing was sent.
  perAccountPricingRequired: "perAccountPricingRequired",
  // A BadRequest: the workspace's plan has no room for the post when it is
  // due, as after a trial or on a smaller plan.
  planLimit: "planLimit",
  // A BadRequest: a part after the first has no post to reply to, as Peal
  // knows no id for the part before it, or for the first.
  replyTargetUnknown: "replyTargetUnknown",
  // A BadRequest: X's posts would pass the billing account's monthly
  // ceiling for X, or the cap before its first invoice is paid: nothing
  // was sent.
  xCeilingReached: "xCeilingReached",
  // A BadRequest: a later part of a thread on X the meter refused, its
  // first parts live: the thread was cut there.
  xThreadCut: "xThreadCut",
} as const;

/**
 * What a `BadRequest` says of the channel a read was for: turned off
 * (`disabled`), no longer connected (`disconnected`), or nothing of the
 * channel (`other`: the platform's refusal, or the outbound guard's), which
 * never means the channel is missing.
 */
export type ChannelRefusal = "disabled" | "disconnected" | "other";

/** What a `BadRequest`'s code says of the channel (`ChannelRefusal`). */
export const channelRefusalOf = (code: string): ChannelRefusal => {
  if (code === ownRefusalCodes.channelDisabled) {
    return "disabled";
  }

  return code === ownRefusalCodes.channelDisconnected
    ? "disconnected"
    : "other";
};

/**
 * The code of a `PlatformUnavailable` for a read that got an answer and no
 * data: the platform refused it, or Peal's outbound guard refused the
 * platform's host. Unlike an outage, it may come back the same each time
 * (an app the platform has not audited) until the server's operator reads
 * the logs, which name the refusal's own code. Never stored.
 */
export const readRefusedCode = "readRefused";

/**
 * The codes adapters give a platform's refusal that has a failure reason of
 * its own, rather than `contentRejected`. They are stored in the
 * publication journal too, so never change one.
 */
export const platformRefusalCodes = {
  // A BadRequest: a chat's channel is a forum, whose posts need a title
  // the post has none of (Discord: a forum or media channel's webhook
  // takes a message only with `thread_name`).
  forumThreadNameRequired: "forumThreadNameRequired",
  // A BadRequest: the chat moved to another id, and the channel must be
  // connected again with the new chat (Telegram: a group that became a
  // supergroup, `migrate_to_chat_id`).
  chatMigrated: "chatMigrated",
  // A BadRequest: the app may not post in the chat's channel, which the
  // member fixes on the platform (Slack: the app is not in the channel,
  // `not_in_channel`, or the channel was archived or restricted).
  cannotPost: "cannotPost",
  // A BadRequest of an edit the platform refuses without telling why, the
  // same text again among the reasons (Telegram: "message is not
  // modified", a 400 like any other). After a try that got no answer, it
  // is the edit that landed (`editAfterRepeat`).
  editRefusedOrSame: "editRefusedOrSame",
  // A BadRequest: the post names a title for a forum post, and the
  // channel is no forum (Discord: 220003). Its failure reason is
  // `contentRejected`; the code tells the member what to change.
  threadNameNotTaken: "threadNameNotTaken",
  // A BadRequest: the platform takes only some posts from this server's
  // app until it approves it (TikTok: private posts from an app it has not
  // audited).
  appNotAudited: "appNotAudited",
  // A BadRequest: the platform does not let this server's app post a later
  // part as a reply (X, on self-serve access, takes a reply only from an
  // account the post's author mentioned or quoted).
  repliesNotAllowed: "repliesNotAllowed",
  // A BadRequest: the post a later part answers is gone from the platform
  // (Bluesky: its record no longer exists).
  replyTargetGone: "replyTargetGone",
} as const;

/**
 * The codes of a PlatformUnavailable that the server's operator must fix:
 * the platform refuses every call of the server's app until its account
 * with the platform is paid for. The policy keeps the post waiting, tried
 * again at a gentle pace until a day after its time, as the operator can
 * pay at any moment; a target that gave up fails as appBillingLimit, never
 * as the post's fault. Stored in the journal too, so never change one.
 */
export const operatorRefusalCodes = {
  // X: the app's pay-per-use credits are used up (HTTP 402).
  creditsDepleted: "creditsDepleted",
  // X: the app reached the spending cap set on its account (`usage-capped`).
  usageCapped: "usageCapped",
} as const;

const operatorRefusals: ReadonlySet<string> = new Set(
  Object.values(operatorRefusalCodes)
);

/** Whether an unavailable platform's code is the operator's to fix. */
export const isOperatorRefusal = (code: string | undefined): code is string =>
  code !== undefined && operatorRefusals.has(code);

/**
 * The codes of a RateLimited that waits for a daily allowance to reset,
 * kept in the journal too: the platform's quota for this server's API
 * project, as Peal counts it or the platform answers (`quotaExceeded`), or
 * the account's own daily uploads (`uploadLimitExceeded`), both YouTube's.
 * A target that waited past them fails as quotaExceeded, not rateLimited.
 */
export const dailyLimitCodes = {
  accountUploads: "uploadLimitExceeded",
  projectQuota: "quotaExceeded",
} as const;

const dailyLimits: ReadonlySet<string> = new Set(
  Object.values(dailyLimitCodes)
);

/** Whether a rate limit's code names a daily allowance. */
export const isDailyLimit = (code: string | undefined): boolean =>
  code !== undefined && dailyLimits.has(code);
