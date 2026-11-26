import { Duration, Effect, Match, Option, Schema } from "effect";
import { ClusterSchema } from "effect/cluster";
import { Activity, DurableClock, Workflow } from "effect/workflow";

import {
  claimHoldRun,
  holdAttemptRun,
  recordHoldRun,
  removeGoneRun,
  SiteHoldClaimSchema,
  SiteHoldOutcomeSchema,
} from "#publishing/application/site-holds.ts";
import type {
  SiteHoldClaim,
  SiteHoldOutcome,
} from "#publishing/application/site-holds.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import type { EarlierRefusals } from "#publishing/domain/publication-policy.ts";
import { SiteHoldDecisionSchema } from "#publishing/domain/site-hold.ts";
import type { SiteHoldDecision } from "#publishing/domain/site-hold.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { retryingDatabase } from "#shared/infrastructure/workflows/activity-retry.ts";

/**
 * Makes a target's website match its post (`#publishing/domain/site-hold.ts`):
 * hold it for the post's time on a site that publishes it itself, keep
 * it as a draft once taken back, or take it off once the post or the
 * channel went. It claims the target, then makes calls through the
 * channel's gate, each reading the post as it is then, until one settles
 * it, waiting between them as the decision says (an outage, a rate
 * limit, or every hour for a take-back the site does not answer, until
 * the time it holds the post for), and records a take-back the site
 * never answered (`SiteKeptPost`). A target gone with its draft is taken
 * off its site by the ids the job was started with (`sitePostId`).
 *
 * The payload holds ids alone: nothing a post says is ever in its
 * history. Persisted contract from its first release: the tag, the
 * payload, the idempotency key (`<targetId>:<handOver>`), the activity
 * names `claim`, `call/<n>` and `record`, the clock names `retry/<n>`,
 * and every result schema
 * (`test/publishing/infrastructure/fixtures/persisted/SiteHoldV1`).
 */
export const SiteHoldV1 = Workflow.make("SiteHoldV1", {
  idempotencyKey: ({ handOver, targetId }) => `${targetId}:${handOver}`,
  payload: {
    channelId: ChannelIdSchema,
    // The target's hand-over the job is, from 1: the part of the
    // hand-overs' round its calls are journaled at.
    handOver: Schema.Int,
    // The site's post of a target that goes with its draft, which no row
    // holds once it is gone.
    sitePostId: Schema.optionalKey(PlatformPostIdSchema),
    targetId: PostTargetIdSchema,
  },
  success: SiteHoldOutcomeSchema,
});

type Payload = typeof SiteHoldV1.payloadSchema.Type;

type Working = Exclude<SiteHoldClaim, { readonly _tag: "gone" }>;

// One call: its own activity, so a replay reads its decision back
// instead of calling the site again.
const callAt = (
  payload: Payload,
  claim: Working,
  attempt: number,
  earlier: EarlierRefusals
) =>
  Activity.make({
    execute: Effect.gen(function* call() {
      // The same for every run of this call of this job.
      const idempotencyKey = yield* Activity.idempotencyKey(`call/${attempt}`);

      return yield* Match.valueTags(claim, {
        claimed: ({ postId }) =>
          holdAttemptRun({
            attempt,
            channelId: payload.channelId,
            earlier,
            handOver: payload.handOver,
            idempotencyKey,
            postId,
            targetId: payload.targetId,
          }),
        removeGone: () =>
          Option.match(Option.fromUndefinedOr(payload.sitePostId), {
            onNone: () => Effect.succeed<SiteHoldDecision>({ _tag: "gone" }),
            onSome: (platformPostId) =>
              removeGoneRun({
                channelId: payload.channelId,
                earlier,
                platformPostId,
              }),
          }),
      }).pipe(retryingDatabase);
    }),
    name: `call/${attempt}`,
    success: SiteHoldDecisionSchema,
  });

// The refusals counted once a call was refused for `cause`: a take-back
// tried again every hour counts none, as the policy's tries are over.
const countedIn = (
  earlier: EarlierRefusals,
  cause: "rateLimited" | "takeBack" | "unavailable"
): EarlierRefusals => {
  if (cause === "rateLimited") {
    return { ...earlier, rateLimited: earlier.rateLimited + 1 };
  }

  return cause === "unavailable"
    ? { ...earlier, unavailable: earlier.unavailable + 1 }
    : earlier;
};

// Calls, sleeping and calling again for as long as the decision says:
// how the job's calls ended.
const settle = Effect.fn("SiteHoldV1.settle")(function* settle(
  payload: Payload,
  claim: Working
) {
  let attempt = 1;
  let earlier: EarlierRefusals = { rateLimited: 0, unavailable: 0 };
  let decision = yield* callAt(payload, claim, attempt, earlier);

  while (decision._tag === "retry") {
    yield* DurableClock.sleep({
      duration: decision.delay,
      inMemoryThreshold: Duration.zero,
      name: `retry/${attempt}`,
    });

    earlier = countedIn(earlier, decision.cause);
    attempt += 1;
    decision = yield* callAt(payload, claim, attempt, earlier);
  }

  return decision;
});

export const SiteHoldV1Live = SiteHoldV1.toLayer(
  Effect.fn("SiteHoldV1")(function* siteHold(payload) {
    const claim = yield* Activity.make({
      execute: claimHoldRun(
        payload.targetId,
        Option.fromUndefinedOr(payload.sitePostId)
      ).pipe(retryingDatabase),
      name: "claim",
      success: SiteHoldClaimSchema,
    });

    if (claim._tag === "gone") {
      const outcome: SiteHoldOutcome = "gone";

      return outcome;
    }

    const decision = yield* settle(payload, claim);

    if (decision._tag !== "kept") {
      const outcome: SiteHoldOutcome = decision._tag;

      return outcome;
    }

    return yield* Activity.make({
      execute: recordHoldRun(payload.targetId, decision.at).pipe(
        retryingDatabase
      ),
      name: "record",
      success: SiteHoldOutcomeSchema,
    }).annotate(ClusterSchema.WithTransaction, true);
  })
);
