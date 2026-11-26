import { DateTime, Effect, Match, Option, Schema } from "effect";

import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import type { PostTarget } from "#publishing/domain/post-target.ts";
import type { Post } from "#publishing/domain/post.ts";
import type { EarlierRefusals } from "#publishing/domain/publication-policy.ts";
import { decideRemoval } from "#publishing/domain/removal-decision.ts";
import type { RemovalAttempt } from "#publishing/domain/removal-decision.ts";
import {
  decideHold,
  handOverRound,
  standingWanted,
} from "#publishing/domain/site-hold.ts";
import type {
  HoldStanding,
  SiteHoldDecision,
} from "#publishing/domain/site-hold.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { PostIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId, PostId } from "#shared/domain/ids.ts";
import type { PlatformPostId } from "#shared/domain/publish-result.ts";

import { LivePostClients } from "./live-post-clients.ts";
import { callPlatform } from "./post-publication.ts";
import { PostRepository } from "./post-repository.ts";
import { PublicationScheduler } from "./publication-scheduler.ts";
import { SiteHoldNotices } from "./site-hold-notices.ts";

// The steps of a hand-over's job (`SiteHoldV1`,
// #publishing/infrastructure/workflows/site-hold.ts), which makes a
// target's website match the post: it claims the target, makes calls
// through the channel's gate until one settles it, and records how it
// ended. The schemas below are results the job stores in its history:
// members may be added, never renamed or removed.

/** What a hand-over's job found when it started. */
export const SiteHoldClaimSchema = Schema.Union([
  // The target is there: call its site about its post.
  Schema.TaggedStruct("claimed", { postId: PostIdSchema }),
  // The target went with its draft, and its site held a post for it:
  // take that post off, by the ids the job was started with.
  Schema.TaggedStruct("removeGone", {}),
  // The target went, and nothing of it is known to be on its site.
  Schema.TaggedStruct("gone", {}),
]);

export type SiteHoldClaim = typeof SiteHoldClaimSchema.Type;

/** How a hand-over's job ended. */
export const SiteHoldOutcomeSchema = Schema.Literals([
  // The site matches the post, or had nothing to change.
  "done",
  // Peal gave up: a hold leaves the target to its post's time.
  "gaveUp",
  // The site kept, and published, a post Peal had taken back: told.
  "kept",
  // The target went: nothing was left to change.
  "gone",
]);

export type SiteHoldOutcome = typeof SiteHoldOutcomeSchema.Type;

/** The target as a hand-over's job finds it when it starts. */
export const claimHoldRun = Effect.fn("Publishing.claimHold")(
  function* claimHoldRun(
    targetId: PostTargetId,
    sitePostId: Option.Option<PlatformPostId>
  ) {
    const target = yield* PostRepository.use((posts) =>
      posts.findTarget(targetId)
    );

    if (Option.isSome(target)) {
      const claim: SiteHoldClaim = {
        _tag: "claimed",
        postId: target.value.postId,
      };

      return claim;
    }

    const claim: SiteHoldClaim = Option.isSome(sitePostId)
      ? { _tag: "removeGone" }
      : { _tag: "gone" };

    return claim;
  }
);

// What the target's site is to be made to do now, and the time it holds
// the post for: none once the post or the target went.
const wantedNow = Effect.fn("Publishing.wantedNow")(function* wantedNow(
  postId: PostId,
  targetId: PostTargetId
) {
  const posts = yield* PostRepository;
  const stored = yield* posts.find(postId);
  const target = yield* posts.findTarget(targetId);

  if (Option.isNone(stored) || Option.isNone(target)) {
    return Option.none<{
      readonly heldFor: Option.Option<DateTime.Utc>;
      readonly wanted: HoldStanding;
    }>();
  }

  return Option.some({
    heldFor: Option.fromUndefinedOr(target.value.onSite?.publishAt),
    wanted: standingWanted(
      stored.value.post,
      target.value,
      yield* DateTime.now
    ),
  });
});

/** One call of a hand-over's job. */
export interface HoldAttempt {
  readonly attempt: number;
  readonly channelId: ChannelId;
  /** The refusals of the job's calls before this one, as it counted them. */
  readonly earlier: EarlierRefusals;
  /** The target's hand-over this job is: the part its calls are at. */
  readonly handOver: number;
  // Unique to this call of this job, and the same for every run of it.
  readonly idempotencyKey: string;
  readonly postId: PostId;
  readonly targetId: PostTargetId;
}

const targetGone: SiteHoldDecision = { _tag: "gone" };

/**
 * Makes one call of a hand-over and decides what follows
 * (`decideHold`): the call is journaled as any publishing call, in the
 * hand-overs' round at the job's part, and the router reads the post
 * inside the gate, so the site is asked for what the post wants then. A
 * take-back whose time has passed makes no call: the site published the
 * post then (`kept`).
 */
export const holdAttemptRun = Effect.fn("Publishing.holdAttempt")(
  function* holdAttemptRun(attempt: HoldAttempt) {
    const before = yield* wantedNow(attempt.postId, attempt.targetId);

    if (Option.isNone(before)) {
      return targetGone;
    }

    const { heldFor, wanted } = before.value;
    const now = yield* DateTime.now;

    if (
      (wanted._tag === "draft" || wanted._tag === "remove") &&
      Option.isSome(heldFor) &&
      !DateTime.isGreaterThan(heldFor.value, now)
    ) {
      const kept: SiteHoldDecision = { _tag: "kept", at: heldFor.value };

      return kept;
    }

    const { finishedAt, outcome, startedAt } = yield* callPlatform(
      {
        attempt: attempt.attempt,
        channelId: attempt.channelId,
        handOver: true,
        idempotencyKey: attempt.idempotencyKey,
        part: attempt.handOver,
        postId: attempt.postId,
        round: handOverRound,
        scheduledAt: now,
        targetId: attempt.targetId,
      },
      false
    );

    // What the post wants of the site once the call ended, which a
    // take-back the site did not answer keeps asking for.
    const after = yield* wantedNow(attempt.postId, attempt.targetId);

    return Option.match(after, {
      onNone: () => targetGone,
      onSome: (read) =>
        decideHold(outcome, {
          earlier: attempt.earlier,
          heldFor: read.heldFor,
          now: finishedAt,
          startedAt,
          wanted: read.wanted,
        }),
    });
  }
);

/**
 * One call taking off the post a target gone with its draft left on its
 * site, by the ids the job holds, through the channel's gate as any
 * unpublishing: retried as a removal is (`decideRemoval`).
 */
export const removeGoneRun = Effect.fn("Publishing.removeGone")(
  function* removeGoneRun(request: {
    readonly channelId: ChannelId;
    readonly earlier: EarlierRefusals;
    readonly platformPostId: PlatformPostId;
  }) {
    const clients = yield* LivePostClients;

    const attempt: RemovalAttempt = yield* clients
      .remove({
        channelId: request.channelId,
        platformPostId: request.platformPostId,
      })
      .pipe(
        Effect.map((outcome): RemovalAttempt => ({
          _tag: "removed",
          alreadyGone: outcome === "alreadyGone",
        })),
        Effect.catch((error) => Effect.succeed(error))
      );

    const decision = decideRemoval(attempt, {
      reached: 0,
      rateLimited: request.earlier.rateLimited,
      unavailable: request.earlier.unavailable,
    });

    return Match.valueTags(decision, {
      edited: (): SiteHoldDecision => ({ _tag: "done" }),
      failed: ({ code }): SiteHoldDecision => ({ _tag: "gaveUp", code }),
      gone: (): SiteHoldDecision => targetGone,
      removed: (): SiteHoldDecision => ({ _tag: "done" }),
      retry: ({ delay, rateLimited }): SiteHoldDecision => ({
        _tag: "retry",
        cause: rateLimited ? "rateLimited" : "unavailable",
        delay,
      }),
    });
  }
);

/**
 * The site kept a post Peal took back, past the time it held it for: the
 * members who schedule are told once (`SiteHoldNotices`), if the target
 * still says so, in one transaction under the post's then the target's
 * locks. Run again, it tells nothing more. A server that tells no one
 * (tests, which build the workers without notices) leaves them out.
 */
export const recordHoldRun = Effect.fn("Publishing.recordHold")(
  function* recordHoldRun(targetId: PostTargetId, at: DateTime.Utc) {
    const posts = yield* PostRepository;
    const notices = yield* Effect.serviceOption(SiteHoldNotices);
    const { transaction } = yield* TransactionRunner;

    return yield* transaction(
      Effect.gen(function* recordInTransaction() {
        const unlocked = yield* posts.findTarget(targetId);

        if (Option.isNone(unlocked)) {
          const outcome: SiteHoldOutcome = "gone";

          return outcome;
        }

        // The post first, then the target, as every use case locks them.
        const locked = yield* posts.lock(unlocked.value.postId);
        const held = yield* posts.lockTarget(targetId);

        if (Option.isNone(locked) || Option.isNone(held)) {
          const outcome: SiteHoldOutcome = "gone";

          return outcome;
        }

        const target = held.value;

        const wanted = standingWanted(
          locked.value.post,
          target,
          yield* DateTime.now
        );

        const stillKept =
          (wanted._tag === "draft" || wanted._tag === "remove") &&
          target.onSite?.publishAt !== undefined &&
          DateTime.Equivalence(target.onSite.publishAt, at);

        if (!stillKept) {
          const outcome: SiteHoldOutcome = "done";

          return outcome;
        }

        yield* Option.match(notices, {
          onNone: () => Effect.void,
          onSome: (told) => told.kept(target, at),
        });

        const outcome: SiteHoldOutcome = "kept";

        return outcome;
      })
    );
  }
);

// Starts the target's next hand-over, and stops the one before it, which
// would ask the site the same.
const handOver = Effect.fn("Publishing.handOver")(function* handOver(
  target: PostTarget,
  sitePostId: Option.Option<PlatformPostId>
) {
  const posts = yield* PostRepository;
  const scheduler = yield* PublicationScheduler;
  const count = yield* posts.nextHandOver(target.id);

  if (count > 1) {
    yield* scheduler.cancelFollow({
      channelId: target.channelId,
      handOver: count - 1,
      targetId: target.id,
    });
  }

  yield* scheduler.follow({
    channelId: target.channelId,
    handOver: count,
    sitePostId,
    targetId: target.id,
  });
});

/**
 * Makes each of the post's websites that publish a post at a time
 * themselves follow it, in the caller's transaction, which holds the
 * post's lock: wherever a post's job is started or stopped (scheduled,
 * moved, back to draft, held for an approval, released, cancelled, a
 * target dropped), and where a target goes with its draft (`gone`, read
 * before its row is deleted). A target its site has nothing to change for
 * starts no job. Never start or stop a post's job without it
 * (`test/publishing/application/site-hold-seams.test.ts`).
 */
export const followOnSites = Effect.fn("Publishing.followOnSites")(
  function* followOnSites(post: Post, gone: readonly PostTarget[] = []) {
    const posts = yield* PostRepository;
    const now = yield* DateTime.now;
    const leaving = new Set(gone.map(({ id }) => id));
    const targets = yield* posts.lockTargets(post.id);

    for (const target of targets) {
      if (leaving.has(target.id)) {
        continue;
      }

      if (standingWanted(post, target, now)._tag !== "none") {
        yield* handOver(target, Option.none());
      }
    }

    yield* followGone(gone);
  }
);

/**
 * Takes off their sites what targets about to go with their draft left
 * there (a draft deleted, a channel taken off it, a dropped target going
 * back to draft), by the ids the jobs are started with: run before their
 * rows are deleted, in the transaction that deletes them.
 */
export const followGone = Effect.fn("Publishing.followGone")(
  function* followGone(gone: readonly PostTarget[]) {
    for (const target of gone) {
      if (target.onSite !== undefined) {
        yield* handOver(target, Option.some(target.onSite.platformPostId));
      }
    }
  }
);
