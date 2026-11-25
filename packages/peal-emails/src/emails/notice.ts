import type { DateTime } from "effect";
import { Match, Option } from "effect";

import type { EmailCatalog, EmailMessages } from "../catalog/email-catalog.ts";
import { catalogs } from "../catalog/index.ts";
import type {
  AutomationStopReason,
  FeedStopReason,
  FollowUpNotSentReason,
  Meter,
  PaidPlan,
  PostFailureReason,
  RecyclingEndReason,
  ReviewParty,
  SlideshowNoticeReason,
  VideoNoticeReason,
} from "../catalog/vocabulary.ts";
import { fill, instantIn, moneyIn } from "../format.ts";
import type { Locale } from "../locale.ts";
import { nameForMail } from "../names.ts";
import type { MessageContent, Money } from "./message-content.ts";
import { resolved } from "./message-content.ts";

/** The account a notice is about, as it was when the notice was made. */
export interface NoticeChannel {
  readonly handle: string;
  readonly platform: string;
}

/** A workspace holds `used` of something a plan allows `allowed` of. */
export interface NoticeExcess {
  readonly allowed: number;
  readonly limit: "channels" | "mediaStorage" | "members";
  readonly used: number;
}

/** Per-account pricing's rates: the accounts free, then each band's price. */
export interface NoticeRates {
  readonly bands: readonly {
    readonly monthly: number;
    readonly upTo: number | null;
  }[];
  readonly currency: string;
  readonly freeAccounts: number;
}

interface PostOn {
  /** None when it was disconnected before the notice was made. */
  readonly channel: Option.Option<NoticeChannel>;
  readonly postId: string;
}

interface OfRule {
  readonly ruleId: string;
}

/**
 * What happened in a workspace, as the server's notices keep it: what each
 * event means, and why it is told, is written there
 * (`notifications/domain/notice-event.ts`).
 */
export type NoticeEvent =
  | (PostOn & {
      readonly _tag: "PostPublished";
      readonly permalink: Option.Option<string>;
    })
  | (PostOn & {
      readonly _tag: "PostFailed";
      readonly notSent?: "firstComment" | "laterParts";
      readonly reason: PostFailureReason;
    })
  | (PostOn & { readonly _tag: "PostUnconfirmed" })
  | {
      readonly _tag: "PostApprovalRequested";
      readonly postId: string;
      readonly scheduledAt: DateTime.Utc;
    }
  | {
      readonly _tag: "PostApproved";
      readonly by: ReviewParty;
      readonly late: boolean;
      readonly postId: string;
    }
  | {
      readonly _tag: "PostChangesRequested";
      readonly by: ReviewParty;
      readonly postId: string;
    }
  | {
      readonly _tag: "PostCommented";
      readonly by: ReviewParty;
      readonly postId: string;
    }
  | {
      readonly _tag: "CommentsReceived";
      readonly count: number;
      readonly postId: string;
      readonly threadId: string;
    }
  | {
      readonly _tag: "MessagesReceived";
      readonly channel: NoticeChannel;
      readonly conversationId: string;
      readonly count: number;
    }
  | {
      readonly _tag: "ChannelReconnectRequired";
      readonly channel: NoticeChannel;
    }
  | {
      readonly _tag: "MessagesTurnedOff";
      readonly channel: NoticeChannel;
    }
  | {
      readonly _tag: "ChannelReconnectSoon";
      readonly channel: NoticeChannel;
      readonly expiresAt: DateTime.Utc;
    }
  | {
      readonly _tag: "SubscriptionStarted";
      readonly interval: "month" | "year";
      readonly plan: PaidPlan;
      readonly price: Money;
      readonly rates?: NoticeRates;
      readonly reference?: string;
      readonly startedAt: DateTime.Utc;
      readonly trialEnd: Option.Option<DateTime.Utc>;
    }
  | {
      readonly _tag: "TrialEnding";
      readonly endsAt: DateTime.Utc;
      readonly over: readonly NoticeExcess[];
      readonly plan: PaidPlan;
    }
  | {
      readonly _tag: "PaymentMethodNeeded";
      readonly accounts: number;
      readonly allowed: number;
      readonly graceUntil: DateTime.Utc;
    }
  | {
      readonly _tag: "PlansRetiring";
      readonly endsAt: DateTime.Utc;
      readonly plan: PaidPlan;
    }
  | {
      readonly _tag: "SubscriptionCancelled";
      readonly endsAt: DateTime.Utc;
      readonly plan: PaidPlan;
    }
  | {
      readonly _tag: "AllowanceReached";
      readonly allowed: number;
      readonly meter: Meter;
      readonly resetsAt: DateTime.Utc;
    }
  | {
      readonly _tag: "XSpendCeiling";
      readonly ceiling: number;
      readonly percent: number;
      readonly resetsAt: DateTime.Utc;
    }
  | {
      readonly _tag: "SubscriptionRenewing";
      readonly plan: PaidPlan;
      readonly price: Money;
      readonly reference?: string;
      readonly renewsAt: DateTime.Utc;
    }
  | {
      readonly _tag: "SubscriptionWithdrawn";
      readonly plan: PaidPlan;
      readonly refunded: Money;
      readonly withdrawnAt: DateTime.Utc;
    }
  | {
      readonly _tag: "WebhookEndpointDisabled";
      readonly endpointId: string;
      readonly host: string;
      readonly reason: "failing" | "gone";
    }
  | {
      readonly _tag: "WebhookDeliveriesFailing";
      readonly endpointId: string;
      readonly host: string;
    }
  | (OfRule & {
      readonly _tag: "RecyclingEnded";
      readonly reason: RecyclingEndReason;
      readonly sourcePostId: string;
    })
  | {
      readonly _tag: "FeedStopped";
      readonly feedId: string;
      readonly reason: FeedStopReason;
    }
  | (OfRule & {
      readonly _tag: "FollowUpsNotSent";
      readonly count: number;
      readonly reasons: readonly FollowUpNotSentReason[];
    })
  | (OfRule & {
      readonly _tag: "CommentRuleStopped";
      readonly reason: AutomationStopReason;
    })
  | (OfRule & {
      readonly _tag: "FollowUpRuleStopped";
      readonly reason: AutomationStopReason;
    })
  | {
      readonly _tag: "VideoGenerationEnded";
      readonly generationId: string;
      readonly mediaId: Option.Option<string>;
      readonly outcome: "failed" | "succeeded";
      readonly reason: Option.Option<VideoNoticeReason>;
    }
  | {
      readonly _tag: "SlideshowEnded";
      readonly mediaId: Option.Option<string>;
      readonly outcome: "failed" | "succeeded";
      readonly reason: Option.Option<SlideshowNoticeReason>;
      readonly slideshowId: string;
    }
  | {
      readonly _tag: "AdConnectionReconnectRequired";
      readonly network: string;
    }
  | {
      readonly _tag: "AdBoostChanged";
      readonly boostId: string;
      readonly budget: Money;
      readonly budgetDigits: 0 | 2;
      readonly change:
        | "budgetReached"
        | "ended"
        | "failed"
        | "started"
        | "unconfirmed";
      readonly endsAt: DateTime.Utc;
      readonly postId: string;
      readonly reason: Option.Option<string>;
    };

/** A notice for one reader, as an email. */
export interface NoticeEmail {
  readonly event: NoticeEvent;
  readonly locale: Locale;
  /** The page the email links to, in the reader's language. */
  readonly url: string;
  readonly workspaceName: string;
}

const platformName = (catalog: EmailCatalog, channel: NoticeChannel) =>
  catalog.platforms[channel.platform] ?? channel.platform;

// The account, by its platform and handle, or as a disconnected channel.
const channelPhrase = (
  catalog: EmailCatalog,
  channel: Option.Option<NoticeChannel>
): string =>
  Option.match(channel, {
    onNone: () => catalog.unknownChannel,
    onSome: (known) =>
      fill(
        catalog.channel,
        new Map([
          ["handle", known.handle],
          ["platform", platformName(catalog, known)],
        ])
      ),
  });

const gigabyte = 1_000_000_000;

// Bytes in the decimal units the plans are sold in, as the reader writes
// numbers.
const sizeIn = (bytes: number, locale: Locale): string =>
  bytes >= gigabyte
    ? new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
        style: "unit",
        unit: "gigabyte",
      }).format(bytes / gigabyte)
    : new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
        style: "unit",
        unit: "megabyte",
      }).format(bytes / 1_000_000);

// What a workspace holds beyond the free plan, each against what the plan
// allows, or that it holds nothing beyond it.
const standingIn = (
  catalog: EmailCatalog,
  over: readonly NoticeExcess[],
  locale: Locale
): string => {
  if (over.length === 0) {
    return catalog.withinFreePlan;
  }

  const amount = (limit: NoticeExcess["limit"], count: number) =>
    limit === "mediaStorage" ? sizeIn(count, locale) : String(count);

  const listed = over.map(({ allowed, limit, used }) =>
    fill(
      catalog.excess[limit],
      new Map([
        ["allowed", amount(limit, allowed)],
        ["used", amount(limit, used)],
      ])
    )
  );

  return fill(catalog.overFreePlan, new Map([["over", listed.join(", ")]]));
};

// Per-account pricing's ladder, a part a band, in the reader's words.
const ratesIn = (
  catalog: EmailCatalog,
  { bands, currency, freeAccounts }: NoticeRates,
  locale: Locale
): string => {
  const parts: string[] = [];
  let from = 1;

  for (const { monthly, upTo } of bands) {
    if (monthly === 0 && upTo !== null) {
      parts.push(
        fill(catalog.rates.free, new Map([["count", String(freeAccounts)]]))
      );
    } else {
      const price = moneyIn({ amount: monthly, currency }, locale);

      parts.push(
        upTo === null
          ? fill(
              catalog.rates.lastBand,
              new Map([
                ["from", String(from)],
                ["price", price],
              ])
            )
          : fill(
              catalog.rates.band,
              new Map([
                ["from", String(from)],
                ["price", price],
                ["to", String(upTo)],
              ])
            )
      );
    }

    from = (upTo ?? from) + 1;
  }

  return parts.join(", ");
};

// The body, with what the contract's number is for once it has one.
const numbered = (
  messages: EmailMessages,
  catalog: EmailCatalog,
  reference: string | undefined
): EmailMessages =>
  reference === undefined
    ? messages
    : { ...messages, body: `${messages.body} ${catalog.contractNumber}` };

interface Words {
  /** What the email sets apart in a box, if anything. */
  readonly highlight?: string;
  readonly messages: EmailMessages;
  readonly values: readonly (readonly [string, string])[];
}

const wordsOf = (
  event: NoticeEvent,
  catalog: EmailCatalog,
  locale: Locale
): Words =>
  Match.valueTags(event, {
    AdBoostChanged: ({
      budget,
      budgetDigits,
      change,
      endsAt,
      reason,
    }): Words => ({
      messages: {
        budgetReached: catalog.adBoostBudgetReached,
        ended: catalog.adBoostEnded,
        failed: catalog.adBoostFailed,
        started: catalog.adBoostStarted,
        unconfirmed: catalog.adBoostUnconfirmed,
      }[change],
      values: [
        [
          "budget",
          // An ad account's amounts are in its own minor units, which are
          // whole units for some currencies: brought to hundredths here.
          moneyIn(
            {
              amount: budgetDigits === 0 ? budget.amount * 100 : budget.amount,
              currency: budget.currency,
            },
            locale
          ),
        ],
        ["endsAt", instantIn(endsAt, locale)],
        [
          "reason",
          reason.pipe(
            Option.flatMapNullishOr(
              (name) => catalog.adBoostFailureReasons[name]
            ),
            Option.getOrElse(() => catalog.adBoostFailureOther)
          ),
        ],
      ],
    }),
    AdConnectionReconnectRequired: (): Words => ({
      messages: catalog.adConnectionReconnect,
      values: [],
    }),
    ChannelReconnectRequired: ({ channel }): Words => ({
      messages: catalog.channelReconnectRequired,
      values: [
        ["handle", channel.handle],
        ["platform", platformName(catalog, channel)],
      ],
    }),
    ChannelReconnectSoon: ({ channel, expiresAt }): Words => ({
      messages: catalog.channelReconnectSoon,
      values: [
        ["expiresAt", instantIn(expiresAt, locale)],
        ["handle", channel.handle],
        ["platform", platformName(catalog, channel)],
      ],
    }),
    CommentsReceived: ({ count }): Words => ({
      messages: catalog.commentsReceived,
      values: [["count", String(count)]],
    }),
    MessagesReceived: ({ channel, count }): Words => ({
      messages: catalog.messagesReceived,
      values: [
        ["count", String(count)],
        ["handle", channel.handle],
        ["platform", platformName(catalog, channel)],
      ],
    }),
    MessagesTurnedOff: ({ channel }): Words => ({
      messages: catalog.messagesTurnedOff,
      values: [
        ["handle", channel.handle],
        ["platform", platformName(catalog, channel)],
      ],
    }),
    FeedStopped: ({ reason }): Words => ({
      messages: catalog.feedStopped,
      values: [["reason", catalog.feedStopReasons[reason]]],
    }),
    FollowUpsNotSent: ({ count, reasons }): Words => {
      const one = count === 1;
      const words = catalog.followUpNotSentReasons[one ? "one" : "other"];

      return {
        messages: one ? catalog.followUpNotSent : catalog.followUpsNotSent,
        values: [
          ["count", String(count)],
          [
            "reasons",
            reasons.map((reason) => words[reason]).join(catalog.reasonsJoint),
          ],
        ],
      };
    },
    FollowUpRuleStopped: ({ reason }): Words => ({
      messages: catalog.followUpRuleStopped,
      values: [["reason", catalog.followUpRuleStopReasons[reason]]],
    }),
    CommentRuleStopped: ({ reason }): Words => ({
      messages: catalog.commentRuleStopped,
      values: [["reason", catalog.commentRuleStopReasons[reason]]],
    }),
    VideoGenerationEnded: ({ outcome, reason }): Words =>
      outcome === "succeeded"
        ? { messages: catalog.videoGenerated, values: [] }
        : {
            messages: catalog.videoFailed,
            values: [
              [
                "reason",
                catalog.videoFailureReasons[
                  Option.getOrElse(reason, () => "refused" as const)
                ],
              ],
            ],
          },
    SlideshowEnded: ({ outcome, reason }): Words =>
      outcome === "succeeded"
        ? { messages: catalog.slideshowComposed, values: [] }
        : {
            messages: catalog.slideshowFailed,
            values: [
              [
                "reason",
                catalog.slideshowFailureReasons[
                  Option.getOrElse(reason, () => "refused" as const)
                ],
              ],
            ],
          },
    PostApprovalRequested: ({ scheduledAt }): Words => ({
      messages: catalog.postApprovalRequested,
      values: [["scheduledAt", instantIn(scheduledAt, locale)]],
    }),
    PostApproved: ({ by, late }): Words => ({
      messages: late ? catalog.postApprovedLate : catalog.postApproved,
      values: [["by", catalog.reviewParties[by]]],
    }),
    PostChangesRequested: ({ by }): Words => ({
      messages: catalog.postChangesRequested,
      values: [["by", catalog.reviewParties[by]]],
    }),
    PostCommented: ({ by }): Words => ({
      messages: catalog.postCommented,
      values: [["by", catalog.reviewParties[by]]],
    }),
    PostFailed: ({ channel, notSent, reason }): Words => ({
      messages: {
        firstComment: catalog.firstCommentFailed,
        laterParts: catalog.laterPartsFailed,
        none: catalog.postFailed,
      }[notSent ?? "none"],
      values: [
        ["channel", channelPhrase(catalog, channel)],
        ["reason", catalog.failureReasons[reason]],
      ],
    }),
    PostPublished: ({ channel }): Words => ({
      messages: catalog.postPublished,
      values: [["channel", channelPhrase(catalog, channel)]],
    }),
    PostUnconfirmed: ({ channel }): Words => ({
      messages: catalog.postUnconfirmed,
      values: [["channel", channelPhrase(catalog, channel)]],
    }),
    RecyclingEnded: ({ reason }): Words => ({
      messages: catalog.recyclingEnded,
      values: [["reason", catalog.recyclingEndReasons[reason]]],
    }),
    SubscriptionCancelled: ({ endsAt, plan }): Words => ({
      messages: catalog.subscriptionCancelled,
      values: [
        ["endsAt", instantIn(endsAt, locale)],
        ["plan", catalog.plans[plan]],
      ],
    }),
    SubscriptionRenewing: ({ plan, price, reference, renewsAt }): Words => ({
      highlight: catalog.renewalDeadline,
      messages: numbered(catalog.subscriptionRenewing, catalog, reference),
      values: [
        ["plan", catalog.plans[plan]],
        ["price", moneyIn(price, locale)],
        ["reference", reference ?? ""],
        ["renewsAt", instantIn(renewsAt, locale)],
      ],
    }),
    SubscriptionStarted: ({
      interval,
      plan,
      price,
      rates,
      reference,
      startedAt,
      trialEnd,
    }): Words =>
      rates === undefined
        ? Option.match(trialEnd, {
            onNone: (): Words => ({
              messages: numbered(
                catalog.subscriptionStarted,
                catalog,
                reference
              ),
              values: [
                ["reference", reference ?? ""],
                ["interval", catalog.intervals[interval]],
                ["plan", catalog.plans[plan]],
                ["price", moneyIn(price, locale)],
                ["startedAt", instantIn(startedAt, locale)],
              ],
            }),
            onSome: (endsAt): Words => ({
              messages: numbered(catalog.trialStarted, catalog, reference),
              values: [
                ["reference", reference ?? ""],
                ["endsAt", instantIn(endsAt, locale)],
                ["plan", catalog.plans[plan]],
                ["price", moneyIn(price, locale)],
                ["startedAt", instantIn(startedAt, locale)],
              ],
            }),
          })
        : {
            messages: numbered(catalog.perAccountStarted, catalog, reference),
            values: [
              ["reference", reference ?? ""],
              ["rates", ratesIn(catalog, rates, locale)],
              ["startedAt", instantIn(startedAt, locale)],
            ],
          },
    PaymentMethodNeeded: ({ accounts, allowed, graceUntil }): Words => ({
      messages: catalog.paymentMethodNeeded,
      values: [
        ["accounts", String(accounts)],
        ["allowed", String(allowed)],
        ["graceUntil", instantIn(graceUntil, locale)],
      ],
    }),
    PlansRetiring: ({ endsAt, plan }): Words => ({
      messages: catalog.plansRetiring,
      values: [
        ["endsAt", instantIn(endsAt, locale)],
        ["plan", catalog.plans[plan]],
      ],
    }),
    AllowanceReached: ({ allowed, meter, resetsAt }): Words => ({
      messages: catalog.allowanceReached,
      values: [
        ["allowed", new Intl.NumberFormat(locale).format(allowed)],
        ["meter", catalog.meters[meter]],
        ["resetsAt", instantIn(resetsAt, locale)],
      ],
    }),
    XSpendCeiling: ({ ceiling, percent, resetsAt }): Words => ({
      messages:
        percent >= 100 ? catalog.xCeilingReached : catalog.xCeilingNearing,
      values: [
        ["ceiling", moneyIn({ amount: ceiling, currency: "usd" }, locale)],
        ["percent", String(percent)],
        ["resetsAt", instantIn(resetsAt, locale)],
      ],
    }),
    SubscriptionWithdrawn: ({ plan, refunded, withdrawnAt }): Words => ({
      messages: catalog.subscriptionWithdrawn,
      values: [
        ["plan", catalog.plans[plan]],
        ["refunded", moneyIn(refunded, locale)],
        ["withdrawnAt", instantIn(withdrawnAt, locale)],
      ],
    }),
    TrialEnding: ({ endsAt, over, plan }): Words => ({
      messages: catalog.trialEnding,
      values: [
        ["endsAt", instantIn(endsAt, locale)],
        ["plan", catalog.plans[plan]],
        ["standing", standingIn(catalog, over, locale)],
      ],
    }),
    WebhookDeliveriesFailing: ({ host }): Words => ({
      messages: catalog.webhookDeliveriesFailing,
      values: [["host", host]],
    }),
    WebhookEndpointDisabled: ({ host, reason }): Words => ({
      messages: catalog.webhookEndpointDisabled,
      values: [
        ["host", host],
        ["reason", catalog.webhookTurnOffReasons[reason]],
      ],
    }),
  });

/** A notice's content, in its reader's language. */
export const noticeContent = (email: NoticeEmail): MessageContent => {
  const catalog = catalogs[email.locale];

  const {
    highlight,
    messages,
    values: own,
  } = wordsOf(email.event, catalog, email.locale);

  const values: ReadonlyMap<string, string> = new Map([
    ...own,
    [
      "workspaceName",
      nameForMail(email.workspaceName, catalog.withheldNames.workspace),
    ],
  ]);

  const content = resolved(messages, values, email.url);

  return highlight === undefined
    ? content
    : { ...content, highlight: fill(highlight, values) };
};
