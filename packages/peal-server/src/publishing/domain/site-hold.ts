import { DateTime, Duration, Match, Option, Schema } from "effect";

import type { AttemptOutcome } from "#shared/domain/attempt-outcome.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import { siteRules } from "#shared/domain/rich-text/site-rules.ts";

import { isDropped } from "./post-target.ts";
import type { PostTarget } from "./post-target.ts";
import type { Post } from "./post.ts";
import { decide, defaultPublicationPolicy } from "./publication-policy.ts";
import type {
  EarlierRefusals,
  PublicationPolicy,
} from "./publication-policy.ts";

// A website that publishes a post at a time itself (WordPress,
// WordPress.com, DEV: `siteRules[platform].schedulesItself`) is handed a
// post scheduled for later as soon as it is scheduled, and publishes it
// itself then. Peal keeps the site's copy in step with the post until
// that time: a job of its own (`SiteHoldV1`) asks the site, inside the
// channel's gate, for what the post wants as it is when the call runs,
// and nothing else:
//
// | The post, when the call runs         | What the site is asked          |
// | ------------------------------------ | ------------------------------- |
// | scheduled, the target pending        | hold it for the post's time     |
// | draft or awaiting an approval        | keep it as a draft, if it has it |
// | cancelled, or the target dropped     | remove it, if it has it         |
// | publishing or finished               | nothing: the target's own job   |
//
// A new hand-over is made only while the post's time is more than
// `handOverLead` away; closer, Peal publishes it at its time, as for any
// channel, and a site's `draft` status is never handed over ahead.
//
// As every call reads the post as it is when it runs, one after the other
// in the channel's gate, a job started earlier never undoes what a later
// one made: it asks for the same. A hand-over's calls are journaled
// apart from the target's rounds (`handOverRound`, one part a hand-over),
// so the target's rounds count what they counted, and the post's round
// at its time looks, as any new round does, for a post a lost answer may
// have left on the site (`committedBefore`).

/**
 * The round a hand-over's calls are journaled in: none of the target's
 * own rounds, which start at 1. Each hand-over of a target is a part of
 * it of its own (its count, from 1). Stored in the journal: never change
 * it.
 */
export const handOverRound = 0;

/** How long before its time a post is last handed over to its site. */
export const handOverLead = Duration.minutes(15);

/**
 * The code the router answers a hand-over's call with when the site has
 * nothing to change: nothing was sent. Stored in the publication journal:
 * never change it.
 */
export const siteUnchanged = "siteUnchanged";

/** What a hand-over's call is to make the site do. */
export type HoldStanding =
  // Hold the post for the site to publish itself at `at`.
  | { readonly _tag: "hold"; readonly at: DateTime.Utc }
  // Keep the site's post as a draft: Peal took it back.
  | { readonly _tag: "draft" }
  // Take the site's post off: the post or the channel went.
  | { readonly _tag: "remove" }
  // Nothing to change on the site.
  | { readonly _tag: "none" };

const none: HoldStanding = { _tag: "none" };

/**
 * Whether the target goes to a website that publishes a post at a time
 * itself, and is to be handed over: its options are such a site's, and
 * their site status is not a draft to finish there.
 */
export const handsOver = (target: PostTarget): boolean =>
  Option.exists(
    target.options,
    (options) =>
      isSitePlatform(options.platform) &&
      siteRules[options.platform].schedulesItself &&
      ("siteStatus" in options ? options.siteStatus : undefined) !== "draft"
  );

/**
 * What the target's website is to be made to show of the post, as it is
 * at `now`: the table above, as a pure function.
 */
export const standingWanted = (
  post: Post,
  target: PostTarget,
  now: DateTime.Utc
): HoldStanding => {
  const onSite = target.onSite !== undefined;
  const takeBack: HoldStanding = onSite ? { _tag: "draft" } : none;
  const remove: HoldStanding = onSite ? { _tag: "remove" } : none;

  if (target.status._tag === "cancelled" || isDropped(target)) {
    return remove;
  }

  if (target.status._tag !== "pending") {
    return none;
  }

  return Match.valueTags(post.status, {
    awaitingApproval: () => takeBack,
    cancelled: () => remove,
    draft: () => takeBack,
    finished: () => none,
    publishing: () => none,
    scheduled: ({ schedule }): HoldStanding => {
      const heldThen =
        target.onSite?.publishAt !== undefined &&
        DateTime.Equivalence(target.onSite.publishAt, schedule.at);

      const farEnough = Duration.isGreaterThan(
        DateTime.distance(now, schedule.at),
        handOverLead
      );

      return handsOver(target) && (heldThen || farEnough)
        ? { _tag: "hold", at: schedule.at }
        : takeBack;
    },
  });
};

/**
 * How a hand-over's job ends a call, or goes on. Stored in the job's
 * history: add members and fields, never rename or remove one.
 */
export const SiteHoldDecisionSchema = Schema.Union([
  // The site shows the post as the post wants it, or had nothing to
  // change, or the call's answer was lost: the job ends.
  Schema.TaggedStruct("done", {}),
  // Try again after `delay`.
  Schema.TaggedStruct("retry", { delay: Schema.DurationFromMillis }),
  // Peal gave up: a hold leaves the target to go out, or fail, at the
  // post's time, as any target; `code` is the site's or Peal's reason.
  Schema.TaggedStruct("gaveUp", { code: Schema.optionalKey(Schema.String) }),
  // The site never answered a take-back, and its time, `at`, has
  // passed: the site has published what Peal no longer wanted.
  Schema.TaggedStruct("kept", { at: Schema.DateTimeUtc }),
  // The target went, with its draft or its workspace: nothing is left to
  // change.
  Schema.TaggedStruct("gone", {}),
]);

export type SiteHoldDecision = typeof SiteHoldDecisionSchema.Type;

/** How often a take-back the site does not answer is tried again. */
export const takeBackRetry = Duration.hours(1);

/**
 * What follows a hand-over's call, given how it ended, the refusals of
 * the round's earlier calls, and what the site is still to be made to do
 * now (`wanted`, read after the call) with the time it holds the post
 * for, if any (`heldFor`):
 *
 * - answered (published), nothing to change (`siteUnchanged`), or an
 *   answer lost after the site may have made the post (unconfirmed, which
 *   the target's round at its time looks for): done;
 * - an outage or a rate limit: tried again as the posts' policy says
 *   (`decide`), as no call that may have made the post is ever repeated;
 * - given up: a hold is left for the post's time; a take-back or a
 *   removal is tried again every `takeBackRetry` until the time the site
 *   holds the post for has passed (`kept`).
 */
export const decideHold = (
  outcome: AttemptOutcome,
  context: {
    readonly earlier: EarlierRefusals;
    readonly heldFor: Option.Option<DateTime.Utc>;
    readonly now: DateTime.Utc;
    readonly startedAt: DateTime.Utc;
    readonly wanted: HoldStanding;
  },
  policy: PublicationPolicy = defaultPublicationPolicy
): SiteHoldDecision => {
  if (
    outcome._tag === "published" ||
    outcome._tag === "unconfirmed" ||
    (outcome._tag === "BadRequest" && outcome.code === siteUnchanged)
  ) {
    return { _tag: "done" };
  }

  const decision = decide(
    outcome,
    {
      earlier: context.earlier,
      sinceScheduled: Duration.zero,
      startedAt: context.startedAt,
    },
    policy
  );

  if (decision._tag === "retry") {
    return { _tag: "retry", delay: decision.delay };
  }

  return afterGivingUp(
    decision.settlement._tag === "failed"
      ? Option.fromUndefinedOr(decision.settlement.code)
      : Option.none(),
    context
  );
};

/**
 * Where a hand-over's job stands once a call was given up: a take-back
 * or a removal the site holds a time for is tried again every
 * `takeBackRetry`, or sooner at that time, until it has passed (`kept`);
 * anything else ends.
 */
export const afterGivingUp = (
  code: Option.Option<string>,
  {
    heldFor,
    now,
    wanted,
  }: {
    readonly heldFor: Option.Option<DateTime.Utc>;
    readonly now: DateTime.Utc;
    readonly wanted: HoldStanding;
  }
): SiteHoldDecision => {
  const takingBack = wanted._tag === "draft" || wanted._tag === "remove";

  if (!takingBack || Option.isNone(heldFor)) {
    return Option.match(code, {
      onNone: (): SiteHoldDecision => ({ _tag: "gaveUp" }),
      onSome: (given): SiteHoldDecision => ({ _tag: "gaveUp", code: given }),
    });
  }

  const at = heldFor.value;

  if (!DateTime.isGreaterThan(at, now)) {
    return { _tag: "kept", at };
  }

  return {
    _tag: "retry",
    delay: Duration.min(takeBackRetry, DateTime.distance(now, at)),
  };
};
