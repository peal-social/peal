import { Schema, SchemaTransformation } from "effect";

import {
  PublishedSchema,
  UnconfirmedReasonSchema,
} from "#shared/domain/publish-result.ts";

/**
 * Why an article failed. Stored in `publishing.articles.state` and in the
 * history of its job, so members may be added but never renamed or
 * removed.
 */
export const ArticleFailureReasonSchema = Schema.Literals([
  // The site refused the article as sent: a title or a term it would not
  // take, against its rules, or a request it could not read.
  "contentRejected",
  // The website's channel was disconnected from the workspace before the
  // article went out, or the article was gone from Peal: nothing was sent.
  "channelDisconnected",
  // The website's channel was turned off before the article went out:
  // nothing was sent.
  "channelDisabled",
  // One of the images it shows was deleted from the library, or is no
  // longer ready, before the article went out: nothing was sent.
  "mediaRemoved",
  // The site refused one of its images.
  "mediaRejected",
  // The server was down when the article was due, and it was too late to
  // send when it came back.
  "missed",
  // The site kept rate limiting until the attempt gave up.
  "rateLimited",
  // The site refused the channel's credential: the member reconnects the
  // website.
  "tokenExpired",
  // The site could not be reached, and nothing was sent.
  "unavailable",
  // The workspace's plan had no room for it when it was due: more channels
  // or members than the plan allows, as after a trial or on a smaller
  // plan. Nothing was sent; the member makes room or moves to a larger
  // plan, then sends it again.
  "planLimit",
]);

export type ArticleFailureReason = typeof ArticleFailureReasonSchema.Type;

/**
 * The reasons posts fail for that an article never does. Before articles
 * had reasons of their own, they failed for the posts' ones, and a site
 * answering a code posts read as Peal's own (`appNotAudited`,
 * `repliesNotAllowed` and the others) was stored as that reason: the
 * release before still does. Such a reason is read as `contentRejected`,
 * the site's refusal it was, with its code kept. It is the posts' list
 * less articles' ten, which `test/publishing/domain/article-policy.test.ts`
 * checks: a reason posts gain fails that test until someone decides how
 * articles read it.
 */
export const postReasonsReadAsContentRejected = [
  "notPublished",
  "quotaExceeded",
  "appNotAudited",
  "appBillingLimit",
  "partsNotSent",
  "repliesNotAllowed",
  "paymentMethodRequired",
  "xCeilingReached",
  "paymentFailed",
  "perAccountPricingRequired",
  "xThreadCut",
  "forumThreadNameRequired",
  "chatMigrated",
  "cannotPost",
] as const;

const isArticleReason = Schema.is(ArticleFailureReasonSchema);

/**
 * Why a stored article failed, as articles read it back: the ten as they
 * are, and the posts' others (`postReasonsReadAsContentRejected`) as
 * `contentRejected`. It encodes the ten unchanged, and only those are
 * ever written; any other string fails to decode, so a corrupted row is
 * not hidden.
 */
export const ArticleStoredFailureReasonSchema = Schema.Literals([
  ...ArticleFailureReasonSchema.literals,
  ...postReasonsReadAsContentRejected,
]).pipe(
  Schema.decodeTo(
    ArticleFailureReasonSchema,
    SchemaTransformation.transform({
      decode: (reason): ArticleFailureReason =>
        isArticleReason(reason) ? reason : "contentRejected",
      encode: (reason) => reason,
    })
  )
);

/**
 * How sending an article ended, once no attempt is left to make: on its
 * site, unconfirmed, failed and why, or cancelled, when it was deleted
 * while its job waited. Stored in the job's history, so members and fields
 * may be added but never renamed or removed.
 */
export const ArticleSettlementSchema = Schema.Union([
  PublishedSchema,
  // Whether the article is on its site is not known.
  Schema.TaggedStruct("unconfirmed", {
    // When the call that may have made it started. Settlements stored
    // before it existed have none: the article's start stands in for it.
    attemptedAt: Schema.optionalKey(Schema.DateTimeUtc),
    reason: UnconfirmedReasonSchema,
  }),
  Schema.TaggedStruct("failed", {
    // The site's own reason, or Peal's, for support. Never content.
    code: Schema.optionalKey(Schema.String),
    reason: ArticleStoredFailureReasonSchema,
  }),
  Schema.TaggedStruct("cancelled", {}),
]);

export type ArticleSettlement = typeof ArticleSettlementSchema.Type;

/**
 * Try again after `delay`, or settle the article: what each attempt of its
 * job (`send/<n>`) stores in its history, so members and fields may be
 * added but never renamed or removed.
 */
export const ArticleDecisionSchema = Schema.Union([
  Schema.TaggedStruct("retry", { delay: Schema.DurationFromMillis }),
  Schema.TaggedStruct("settle", { settlement: ArticleSettlementSchema }),
]);

export type ArticleDecision = typeof ArticleDecisionSchema.Type;
