import { DateTime, Option, Struct } from "effect";

import { english } from "../../src/catalog/english.ts";
import type { AccountEmail } from "../../src/emails/account.ts";
import type { WeeklyDigestEmail } from "../../src/emails/digest-content.ts";
import type { NoticeChannel, NoticeEvent } from "../../src/emails/notice.ts";
import type { WelcomeEmail } from "../../src/emails/welcome.ts";
import type { Locale } from "../../src/locale.ts";

// Every email with made-up values, which the previews show and the tests
// read: an event without a sample here, or a sample without a preview, does
// not pass them.

const at = (iso: string) => DateTime.makeUnsafe(iso);

const app = "https://app.example.test";

/** The page a notice links to. */
export const noticeUrl = `${app}/0b1c/posts/0190`;

/** The workspace notices are about. */
export const workspaceName = "Studio Nord";

/** Who sends, as an operator may state it. */
export const identity = "Synthetic Studio SAS";

const postId = "00000000-0000-7000-8000-000000000001";

const ruleId = "00000000-0000-7000-8000-00000000f001";

const channel: NoticeChannel = { handle: "@studio", platform: "mastodon" };

const contractRequest = {
  _tag: "ContractRequestAcknowledged",
  contract: "Studio Nord",
  desiredAt: null,
  effectiveAt: null,
  kind: "cancellation",
  name: "Camille Synthetic",
  receivedAt: at("2026-11-10T08:05:00Z"),
  refunded: null,
  to: "camille@example.test",
  url: `${app}/contract-request?token=synthetic`,
} as const;

/** The welcome, in `locale`. */
export const welcomeSample = (locale: Locale): WelcomeEmail => ({
  locale,
  signer: "Camille Synthetic",
  url: locale === "fr" ? `${app}/fr` : `${app}/`,
});

/** Each account email, in `locale`, by name. */
export const accountSamples = (locale: Locale) => {
  const link = { locale, to: "ada@example.test", url: `${app}/account` };

  const deleted = {
    ...link,
    _tag: "AccountDeleted",
    subscriptionsCancelled: 0,
  } as const;

  const twoStep = {
    ...link,
    _tag: "TwoStepChanged",
    recoveryCodesLeft: null,
  } as const;

  const request = { ...contractRequest, locale };

  return {
    accountDeleted: { ...deleted, legalHold: null, subscriptionsCancelled: 1 },
    accountDeletedConnectionsKept: {
      ...deleted,
      legalHold: {
        accountYears: null,
        connectionYears: 2,
        identityYears: null,
      },
    },
    accountDeletedIdentityKept: {
      ...deleted,
      legalHold: { accountYears: 1, connectionYears: 1, identityYears: 5 },
    },
    cancellationApplied: {
      ...request,
      effectiveAt: at("2026-12-01T00:00:00Z"),
      outcome: "cancelled",
      refunded: { amount: 1500, currency: "eur" },
    },
    cancellationAppliedLater: {
      ...request,
      desiredAt: at("2027-02-15T00:00:00Z"),
      effectiveAt: at("2027-02-15T00:00:00Z"),
      outcome: "cancelled",
    },
    cancellationNotSubscribed: { ...request, outcome: "notSubscribed" },
    cancellationNothingToCancel: { ...request, outcome: "nothingToCancel" },
    cancellationToConfirm: { ...request, outcome: "confirm" },
    cancellationToReview: { ...request, contract: "", outcome: "review" },
    dataExported: { ...link, _tag: "DataExported", via: "web" },
    dataExportedCommandLine: {
      ...link,
      _tag: "DataExported",
      via: "commandLine",
    },
    invitation: {
      ...link,
      _tag: "Invitation",
      inviterName: "Ada Synthetic",
      role: "editor",
      workspaceName,
    },
    invitationNamesWithheld: {
      ...link,
      _tag: "Invitation",
      inviterName: "admin@example.test",
      role: "viewer",
      workspaceName: "Claim at example.test",
    },
    recoveryCodeUsed: {
      ...twoStep,
      kind: "recoveryCodeUsed",
      recoveryCodesLeft: 9,
    },
    recoveryCodeUsedLast: {
      ...twoStep,
      kind: "recoveryCodeUsed",
      recoveryCodesLeft: 0,
    },
    recoveryCodeUsedOneLeft: {
      ...twoStep,
      kind: "recoveryCodeUsed",
      recoveryCodesLeft: 1,
    },
    recoveryCodesRenewed: { ...twoStep, kind: "recoveryCodesRenewed" },
    resetPassword: {
      ...link,
      _tag: "ResetPassword",
      url: `${app}/reset-password?token=synthetic&callbackURL=%2F`,
    },
    twoStepResetByStaff: { ...twoStep, kind: "resetByStaff" },
    twoStepTurnedOff: { ...twoStep, kind: "turnedOff" },
    twoStepTurnedOn: { ...twoStep, kind: "turnedOn" },
    verifyEmail: {
      ...link,
      _tag: "VerifyEmail",
      url: `${app}/verify-email?token=synthetic&callbackURL=%2F`,
    },
    withdrawalApplied: {
      ...request,
      effectiveAt: at("2026-11-10T08:05:00Z"),
      kind: "withdrawal",
      outcome: "withdrawn",
      refunded: { amount: 810, currency: "eur" },
    },
    withdrawalAppliedUnpaid: {
      ...request,
      effectiveAt: at("2026-11-10T08:05:00Z"),
      kind: "withdrawal",
      outcome: "withdrawn",
    },
    withdrawalBusiness: { ...request, kind: "withdrawal", outcome: "business" },
    withdrawalExpired: { ...request, kind: "withdrawal", outcome: "expired" },
    workspaceDeleted: {
      ...link,
      _tag: "WorkspaceDeleted",
      subscriptionsCancelled: 1,
      workspaceName,
    },
    workspaceDeletedUnpaid: {
      ...link,
      _tag: "WorkspaceDeleted",
      subscriptionsCancelled: 0,
      workspaceName: 'Studio "Nord" & Co',
    },
  } as const satisfies Readonly<Record<string, AccountEmail>>;
};

const boost = {
  _tag: "AdBoostChanged",
  boostId: "00000000-0000-7000-8000-000000000061",
  budget: { amount: 2500, currency: "eur" },
  budgetDigits: 2,
  endsAt: at("2026-12-01T09:30:00Z"),
  postId,
  reason: Option.none(),
} as const;

const started = {
  _tag: "SubscriptionStarted",
  interval: "month",
  plan: "pro",
  price: { amount: 1500, currency: "eur" },
  startedAt: at("2026-11-09T10:00:00Z"),
  trialEnd: Option.none(),
} as const;

const renewing = {
  _tag: "SubscriptionRenewing",
  plan: "business",
  price: { amount: 30_000, currency: "eur" },
  renewsAt: at("2027-01-31T00:00:00Z"),
} as const;

const trialEnding = {
  _tag: "TrialEnding",
  endsAt: at("2026-11-23T10:00:00Z"),
  plan: "pro",
} as const;

const xCeiling = {
  _tag: "XSpendCeiling",
  ceiling: 5000,
  resetsAt: at("2026-12-01T00:00:00Z"),
} as const;

const failed = {
  _tag: "PostFailed",
  channel: Option.some(channel),
  postId,
  reason: "contentRejected",
} as const;

const reference = "7K3M-9QXD-42TN";

/** Each notice, by name. */
export const noticeSamples = {
  adBoostBudgetReached: { ...boost, change: "budgetReached" },
  adBoostEnded: {
    ...boost,
    budget: { amount: 2500, currency: "jpy" },
    budgetDigits: 0,
    change: "ended",
  },
  adBoostFailed: { ...boost, change: "failed" },
  adBoostStarted: { ...boost, change: "started" },
  adBoostUnconfirmed: { ...boost, change: "unconfirmed" },
  adConnectionReconnectRequired: {
    _tag: "AdConnectionReconnectRequired",
    network: "meta",
  },
  allowanceReached: {
    _tag: "AllowanceReached",
    allowed: 1000,
    meter: "outboundMessages",
    resetsAt: at("2026-12-01T00:00:00Z"),
  },
  channelReconnectRequired: { _tag: "ChannelReconnectRequired", channel },
  channelReconnectSoon: {
    _tag: "ChannelReconnectSoon",
    channel: { handle: "@studio.example.test", platform: "bluesky" },
    expiresAt: at("2026-12-01T09:30:00Z"),
  },
  commentRuleStopped: {
    _tag: "CommentRuleStopped",
    reason: "starterGone",
    ruleId,
  },
  commentsReceived: {
    _tag: "CommentsReceived",
    count: 3,
    postId,
    threadId: "00000000-0000-7000-8000-000000000021",
  },
  feedStopped: {
    _tag: "FeedStopped",
    feedId: "00000000-0000-7000-8000-000000000031",
    reason: "unreachable",
  },
  firstCommentFailed: { ...failed, notSent: "firstComment" },
  followUpNotSent: {
    _tag: "FollowUpsNotSent",
    count: 1,
    reasons: ["failed"],
    ruleId,
  },
  followUpRuleStopped: {
    _tag: "FollowUpRuleStopped",
    reason: "channelGone",
    ruleId,
  },
  followUpsNotSent: {
    _tag: "FollowUpsNotSent",
    count: 3,
    reasons: ["failed", "unconfirmed"],
    ruleId,
  },
  laterPartsFailed: { ...failed, notSent: "laterParts" },
  messagesReceived: {
    _tag: "MessagesReceived",
    channel,
    conversationId: "00000000-0000-7000-8000-000000000041",
    count: 2,
  },
  messagesTurnedOff: { _tag: "MessagesTurnedOff", channel },
  paymentMethodNeeded: {
    _tag: "PaymentMethodNeeded",
    accounts: 5,
    allowed: 2,
    graceUntil: at("2027-01-31T00:00:00Z"),
  },
  perAccountStarted: {
    ...started,
    plan: "payAsYouGo",
    price: { amount: 0, currency: "usd" },
    rates: {
      bands: [
        { monthly: 0, upTo: 2 },
        { monthly: 500, upTo: 10 },
        { monthly: 300, upTo: 100 },
        { monthly: 100, upTo: null },
      ],
      currency: "usd",
      freeAccounts: 2,
    },
    reference,
  },
  plansRetiring: {
    _tag: "PlansRetiring",
    endsAt: at("2027-01-01T00:00:00Z"),
    plan: "starter",
  },
  postApprovalRequested: {
    _tag: "PostApprovalRequested",
    postId,
    scheduledAt: at("2026-12-01T09:30:00Z"),
  },
  postApproved: { _tag: "PostApproved", by: "member", late: false, postId },
  postApprovedLate: { _tag: "PostApproved", by: "visitor", late: true, postId },
  postChangesRequested: { _tag: "PostChangesRequested", by: "visitor", postId },
  postCommented: { _tag: "PostCommented", by: "application", postId },
  postFailed: failed,
  postPublished: {
    _tag: "PostPublished",
    channel: Option.some(channel),
    permalink: Option.some("https://social.example.test/@studio/1"),
    postId,
  },
  postUnconfirmed: {
    _tag: "PostUnconfirmed",
    channel: Option.some(channel),
    postId,
  },
  postUnconfirmedChannelGone: {
    _tag: "PostUnconfirmed",
    channel: Option.none(),
    postId,
  },
  recyclingEnded: {
    _tag: "RecyclingEnded",
    reason: "sourceGone",
    ruleId,
    sourcePostId: postId,
  },
  slideshowComposed: {
    _tag: "SlideshowEnded",
    mediaId: Option.some("00000000-0000-7000-8000-000000000071"),
    outcome: "succeeded",
    reason: Option.none(),
    slideshowId: "00000000-0000-7000-8000-000000000072",
  },
  slideshowFailed: {
    _tag: "SlideshowEnded",
    mediaId: Option.none(),
    outcome: "failed",
    reason: Option.some("timedOut"),
    slideshowId: "00000000-0000-7000-8000-000000000072",
  },
  subscriptionCancelled: {
    _tag: "SubscriptionCancelled",
    endsAt: at("2026-12-01T00:00:00Z"),
    plan: "agency",
  },
  subscriptionRenewing: { ...renewing, reference },
  subscriptionRenewingUnnumbered: renewing,
  subscriptionStarted: { ...started, reference },
  subscriptionStartedUnnumbered: { ...started, interval: "year" },
  subscriptionWithdrawn: {
    _tag: "SubscriptionWithdrawn",
    plan: "starter",
    refunded: { amount: 810, currency: "eur" },
    withdrawnAt: at("2026-11-04T08:15:00Z"),
  },
  trialEnding: {
    ...trialEnding,
    over: [
      { allowed: 3, limit: "channels", used: 8 },
      { allowed: 2, limit: "members", used: 5 },
      { allowed: 500_000_000, limit: "mediaStorage", used: 1_200_000_000 },
    ],
  },
  trialEndingWithinFreePlan: { ...trialEnding, over: [] },
  trialStarted: {
    ...started,
    reference,
    trialEnd: Option.some(at("2026-11-23T10:00:00Z")),
  },
  videoFailed: {
    _tag: "VideoGenerationEnded",
    generationId: "00000000-0000-7000-8000-000000000081",
    mediaId: Option.none(),
    outcome: "failed",
    reason: Option.some("timedOut"),
  },
  videoGenerated: {
    _tag: "VideoGenerationEnded",
    generationId: "00000000-0000-7000-8000-000000000081",
    mediaId: Option.some("00000000-0000-7000-8000-000000000082"),
    outcome: "succeeded",
    reason: Option.none(),
  },
  webhookDeliveriesFailing: {
    _tag: "WebhookDeliveriesFailing",
    endpointId: "00000000-0000-7000-8000-000000000051",
    host: "hooks.example.com",
  },
  webhookEndpointDisabled: {
    _tag: "WebhookEndpointDisabled",
    endpointId: "00000000-0000-7000-8000-000000000051",
    host: "hooks.example.com",
    reason: "failing",
  },
  xCeilingNearing: { ...xCeiling, percent: 80 },
  xCeilingReached: { ...xCeiling, percent: 100 },
} as const satisfies Readonly<Record<string, NoticeEvent>>;

/** The notices whose words depend on a reason, once for each. */
export const reasonSamples: readonly NoticeEvent[] = [
  ...Struct.keys(english.adBoostFailureReasons).map((reason): NoticeEvent => ({
    ...boost,
    change: "failed",
    reason: Option.some(reason),
  })),
  ...Struct.keys(english.commentRuleStopReasons).map((reason): NoticeEvent => ({
    _tag: "CommentRuleStopped",
    reason,
    ruleId,
  })),
  ...Struct.keys(english.failureReasons).map((reason): NoticeEvent => ({
    ...failed,
    reason,
  })),
  ...Struct.keys(english.feedStopReasons).map((reason): NoticeEvent => ({
    ...noticeSamples.feedStopped,
    reason,
  })),
  ...Struct.keys(english.followUpNotSentReasons.one).map(
    (reason): NoticeEvent => ({
      ...noticeSamples.followUpNotSent,
      reasons: [reason],
    })
  ),
  ...Struct.keys(english.followUpNotSentReasons.other).map(
    (reason): NoticeEvent => ({
      ...noticeSamples.followUpsNotSent,
      reasons: [reason],
    })
  ),
  ...Struct.keys(english.followUpRuleStopReasons).map(
    (reason): NoticeEvent => ({ _tag: "FollowUpRuleStopped", reason, ruleId })
  ),
  ...Struct.keys(english.meters).map((meter): NoticeEvent => ({
    ...noticeSamples.allowanceReached,
    meter,
  })),
  ...Struct.keys(english.plans).map((plan): NoticeEvent => ({
    ...noticeSamples.subscriptionCancelled,
    plan,
  })),
  ...Struct.keys(english.platforms).map((platform): NoticeEvent => ({
    _tag: "ChannelReconnectRequired",
    channel: { handle: "@studio", platform },
  })),
  ...Struct.keys(english.recyclingEndReasons).map((reason): NoticeEvent => ({
    ...noticeSamples.recyclingEnded,
    reason,
  })),
  ...Struct.keys(english.reviewParties).map((by): NoticeEvent => ({
    ...noticeSamples.postCommented,
    by,
  })),
  ...Struct.keys(english.slideshowFailureReasons).map(
    (reason): NoticeEvent => ({
      ...noticeSamples.slideshowFailed,
      reason: Option.some(reason),
    })
  ),
  ...Struct.keys(english.videoFailureReasons).map((reason): NoticeEvent => ({
    ...noticeSamples.videoFailed,
    reason: Option.some(reason),
  })),
  ...Struct.keys(english.webhookTurnOffReasons).map((reason): NoticeEvent => ({
    ...noticeSamples.webhookEndpointDisabled,
    reason,
  })),
];

/** The weekly digest, in `locale`: one busy workspace, and a quiet one. */
export const digestSample = (locale: Locale): WeeklyDigestEmail => ({
  calendarUrl: `${app}/2f9a/calendar`,
  locale,
  preferencesUrl: `${app}/2f9a/settings/notifications`,
  week: {
    from: at("2026-11-09T00:00:00Z"),
    to: at("2026-11-16T00:00:00Z"),
    until: at("2026-11-23T00:00:00Z"),
  },
  workspaces: [
    {
      calendarUrl: `${app}/2f9a/calendar`,
      counts: {
        awaitingApproval: 1,
        failed: 1,
        scheduled: 6,
        unconfirmed: 2,
        wentOut: 7,
      },
      engagement: Option.some({
        engagement: 1234,
        impressions: Option.some(56_789),
      }),
      name: "Studio <Nord> & Co",
      planned: [
        { at: at("2026-11-17T08:00:00Z"), excerpt: "Launch day <b>soon</b>" },
        { at: at("2026-11-18T08:00:00Z"), excerpt: "Behind the scenes" },
      ],
      wentOut: [
        { at: at("2026-11-10T09:30:00Z"), excerpt: "Autumn sale" },
        { at: at("2026-11-11T09:30:00Z"), excerpt: "" },
        // Two posts at one time, without text: lines that read alike.
        { at: at("2026-11-11T09:30:00Z"), excerpt: "" },
      ],
    },
    {
      calendarUrl: `${app}/3a7b/calendar`,
      counts: {
        awaitingApproval: 0,
        failed: 0,
        scheduled: 1,
        unconfirmed: 0,
        wentOut: 0,
      },
      engagement: Option.none(),
      name: "studio.example.test",
      planned: [{ at: at("2026-11-19T08:00:00Z"), excerpt: "Open house" }],
      wentOut: [],
    },
  ],
});
