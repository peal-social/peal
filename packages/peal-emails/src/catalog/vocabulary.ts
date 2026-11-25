// The names of what the server tells, which the catalogues give words to:
// the server's own lists, kept here as types. Its renderer does not compile
// while the server names something this package has no words for.

/** Why a rule that acts by itself ended without a member stopping it. */
export type AutomationStopReason = "starterGone" | "channelGone";

/** What became of a request to cancel a contract or withdraw from one. */
export type ContractRequestOutcome =
  | "confirm"
  | "review"
  | "cancelled"
  | "withdrawn"
  | "nothingToCancel"
  | "notSubscribed"
  | "expired"
  | "business";

/** Why a feed stopped making posts. */
export type FeedStopReason =
  | "unreachable"
  | "notAFeed"
  | "gone"
  | "starterGone"
  | "queueGone";

/** Why follow-ups of a rule did not go out. */
export type FollowUpNotSentReason =
  | "failed"
  | "unconfirmed"
  | "windowEnded"
  | "notGranted"
  | "notApproved";

/** What a billing account pays for by use. */
export type Meter =
  | "assistantRequests"
  | "assistantImages"
  | "outboundMessages"
  | "managedAds"
  | "xApi";

/** The plans a workspace pays for. */
export type PaidPlan = "starter" | "pro" | "business" | "agency" | "payAsYouGo";

/** Why a post did not go out on a channel. */
export type PostFailureReason =
  | "contentRejected"
  | "channelDisconnected"
  | "channelDisabled"
  | "mediaRemoved"
  | "mediaRejected"
  | "missed"
  | "notPublished"
  | "rateLimited"
  | "tokenExpired"
  | "unavailable"
  | "appNotAudited"
  | "quotaExceeded"
  | "appBillingLimit"
  | "planLimit"
  | "partsNotSent"
  | "repliesNotAllowed"
  | "paymentMethodRequired"
  | "xCeilingReached"
  | "paymentFailed"
  | "perAccountPricingRequired"
  | "xThreadCut"
  | "forumThreadNameRequired"
  | "chatMigrated"
  | "cannotPost";

/** Why a recycling rule ended before it made all it was asked for. */
export type RecyclingEndReason =
  | "sourceGone"
  | "starterGone"
  | "noChannels"
  | "contentRejected"
  | "planLimit"
  | "queueGone"
  | "queueFull"
  | "sourceWithdrawn";

/** Who did something in a post's review. */
export type ReviewParty = "member" | "visitor" | "application";

/** Why a slide video failed. */
export type SlideshowNoticeReason =
  | "unavailable"
  | "keyUnreadable"
  | "settingsRefused"
  | "addressRefused"
  | "redirected"
  | "unreachable"
  | "refused"
  | "timedOut"
  | "unusableAnswer"
  | "mediaUnavailable"
  | "storageFull"
  | "notStored"
  | "interrupted";

/** What changed in an account's two-step verification. */
export type TwoStepChange =
  | "turnedOn"
  | "turnedOff"
  | "recoveryCodesRenewed"
  | "recoveryCodeUsed"
  | "resetByStaff";

/** Why a video the assistant was asked for failed. */
export type VideoNoticeReason =
  | "unavailable"
  | "keyUnreadable"
  | "settingsRefused"
  | "addressRefused"
  | "redirected"
  | "unreachable"
  | "refused"
  | "timedOut"
  | "unusableAnswer"
  | "imageUnavailable"
  | "storageFull"
  | "notStored"
  | "interrupted";
