import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration, Schema } from "effect";
import { FailureReasonSchema as ContractFailureReasonSchema } from "peal-contract";

import {
  ArticleDecisionSchema,
  ArticleFailureReasonSchema,
  postReasonsReadAsContentRejected,
} from "#articles/domain/article-failure.ts";
import {
  articleDecide,
  articleEarlierRefusalsOf,
} from "#articles/domain/article-policy.ts";
import type { ArticleAttemptContext } from "#articles/domain/article-policy.ts";
import { articleRefusalCodes } from "#articles/domain/article-refusals.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { FailureReasonSchema } from "#publishing/domain/post-target-status.ts";
import {
  decide,
  earlierRefusalsOf,
  PublicationDecisionSchema,
} from "#publishing/domain/publication-policy.ts";
import type { AttemptOutcome } from "#shared/domain/attempt-outcome.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  PlatformPostIdSchema,
  UnconfirmedReasonSchema,
} from "#shared/domain/publish-result.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";

// Articles decide each attempt with a policy of their own, a copy of the
// posts' for what a site can answer: the same figures, the same
// settlements. These tests fail the day either changes alone.

const startedAt = DateTime.makeUnsafe("2026-06-15T08:00:00Z");

const platformPostId = PlatformPostIdSchema.make("4271");

// Every way an attempt to send an article can end.
const outcomes: readonly AttemptOutcome[] = [
  { _tag: "published", platformPostId },
  {
    _tag: "published",
    permalink: "https://site.example/2026/06/15/an-article/",
    platformPostId,
  },
  ...UnconfirmedReasonSchema.literals.map((reason): AttemptOutcome => ({
    _tag: "unconfirmed",
    reason,
  })),
  ...[
    "channelDisconnected",
    "channelDisabled",
    "planLimit",
    "sitePlanRequired",
    "rest_cannot_create",
    "devto422",
    "refused",
  ].map((code) => new BadRequest({ code })),
  ...["mediaUnavailable", "rest_upload_sideload_error", "image_not_taken"].map(
    (code) => new MediaRejected({ code })
  ),
  new PlatformUnavailable(),
  new RateLimited(),
  ...[Duration.zero, Duration.seconds(30), Duration.hours(7)].map(
    (retryAfter) => new RateLimited({ retryAfter })
  ),
  new TokenExpired(),
];

// Every place in a round an attempt can stand.
const contexts: readonly ArticleAttemptContext[] = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  Number.MAX_SAFE_INTEGER,
].flatMap((unavailable) =>
  [0, 6, 7, 8].flatMap((rateLimited) =>
    [
      Duration.zero,
      Duration.hours(1),
      Duration.sum(Duration.hours(23), Duration.minutes(59)),
      Duration.hours(24),
      Duration.hours(25),
    ].map((sinceScheduled) => ({
      earlier: { rateLimited, unavailable },
      sinceScheduled,
      startedAt,
    }))
  )
);

const encodeArticleDecision = Schema.encodeSync(
  Schema.toCodecJson(ArticleDecisionSchema)
);

const encodePostDecision = Schema.encodeSync(
  Schema.toCodecJson(PublicationDecisionSchema)
);

describe("an article's attempt", () => {
  it("is decided as the posts' policy decides it, until the owner decides articles retry otherwise", () => {
    for (const outcome of outcomes) {
      for (const context of contexts) {
        const forArticle = articleDecide(outcome, context);
        const forPost = decide(outcome, context);

        expect(forArticle).toStrictEqual(forPost);
        expect(encodeArticleDecision(forArticle)).toStrictEqual(
          encodePostDecision(forPost)
        );
      }
    }
  });

  it("counts a round's earlier refusals as the posts' policy counts them", () => {
    for (let end = 0; end <= outcomes.length; end += 1) {
      const earlier = outcomes.slice(0, end);

      expect(articleEarlierRefusalsOf(earlier)).toStrictEqual(
        earlierRefusalsOf(earlier)
      );
    }

    expect(
      articleEarlierRefusalsOf([
        new RateLimited(),
        new PlatformUnavailable(),
        new BadRequest({ code: "refused" }),
        new PlatformUnavailable(),
      ])
    ).toStrictEqual({ rateLimited: 1, unavailable: 2 });
  });

  // A site that answers one of the codes posts read as Peal's own has
  // refused the article like any other refusal: it fails as
  // contentRejected, with the site's code kept as it came.
  it.each([
    "appNotAudited",
    "paymentMethodRequired",
    "xCeilingReached",
    "paymentFailed",
    "perAccountPricingRequired",
    "xThreadCut",
    "repliesNotAllowed",
    "forumThreadNameRequired",
    "chatMigrated",
    "cannotPost",
    "partsNotSupported",
    "replyTargetUnknown",
    "replyTargetGone",
  ])("reads a site's own %s as the content refused", (code) => {
    expect(
      articleDecide(new BadRequest({ code }), {
        earlier: { rateLimited: 0, unavailable: 0 },
        sinceScheduled: Duration.zero,
        startedAt,
      })
    ).toStrictEqual({
      _tag: "settle",
      settlement: { _tag: "failed", code, reason: "contentRejected" },
    });
  });

  it("fails only for reasons the posts and the contract know", () => {
    for (const reason of ArticleFailureReasonSchema.literals) {
      expect(FailureReasonSchema.literals).toContain(reason);
      expect(ContractFailureReasonSchema.literals).toContain(reason);
    }
  });

  // A reason posts gain later fails this until someone decides what an
  // article stored with it reads as.
  it("reads every other reason posts know, and only those, as the content refused", () => {
    const own = new Set<string>(ArticleFailureReasonSchema.literals);

    expect([...postReasonsReadAsContentRejected].toSorted()).toStrictEqual(
      FailureReasonSchema.literals
        .filter((reason) => !own.has(reason))
        .toSorted()
    );
  });

  it("reads Peal's own refusals by the codes posts are refused with", () => {
    expect({
      channelDisabled: articleRefusalCodes.channelDisabled,
      channelDisconnected: articleRefusalCodes.channelDisconnected,
      mediaRemoved: articleRefusalCodes.mediaRemoved,
      planLimit: articleRefusalCodes.planLimit,
    }).toStrictEqual({
      channelDisabled: ownRefusalCodes.channelDisabled,
      channelDisconnected: ownRefusalCodes.channelDisconnected,
      mediaRemoved: ownRefusalCodes.mediaRemoved,
      planLimit: ownRefusalCodes.planLimit,
    });
  });
});
