import { Context } from "effect";
import type { DateTime, Effect, Option } from "effect";

import type {
  Slideshow,
  SlideshowFailureReason,
  SlideshowId,
  SlideshowPlan,
  SlideshowStatus,
} from "#assistant/domain/slideshow.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";

/** What a new job is held to as it is recorded. */
export interface SlideshowStartRules {
  /** How many the workspace may ask for since `dayStart`. */
  readonly dailyLimit: number;
  /** Midnight UTC of the day the request counts in. */
  readonly dayStart: DateTime.Utc;
  /** When the request came. */
  readonly now: DateTime.Utc;
  /** Jobs still on their way that were asked for before this were lost. */
  readonly staleBefore: DateTime.Utc;
}

/**
 * How recording a new job went: `started`, with the jobs found lost and
 * failed `interrupted` on the way; `busy`, another of the workspace's is
 * on its way; `exhausted`, the day's count is reached.
 */
export type SlideshowStart =
  | { readonly _tag: "started"; readonly interrupted: readonly Slideshow[] }
  | { readonly _tag: "busy"; readonly slideshowId: SlideshowId }
  | { readonly _tag: "exhausted" };

/** How a job ended. */
export type SlideshowOutcome =
  | { readonly _tag: "succeeded"; readonly mediaId: MediaAssetId }
  | { readonly _tag: "failed"; readonly reason: SlideshowFailureReason };

/** A job its run took: the job, now `running`, and its plan. */
export interface ClaimedSlideshow {
  readonly plan: SlideshowPlan;
  readonly slideshow: Slideshow;
}

/**
 * The slide videos workspaces asked for, one row a job
 * (`assistant.slideshows`), the plan with its captions, or the edit, kept
 * beside it only until the job ends. A database failure is a defect.
 */
export class SlideshowStore extends Context.Service<
  SlideshowStore,
  {
    /**
     * Records a queued job with its plan, under the workspace's rules, in
     * the caller's transaction: first the workspace's jobs still on their
     * way since before `staleBefore` fail `interrupted`, then one still on
     * its way makes it `busy` (the database's unique index decides), then
     * `dailyLimit` jobs since `dayStart` make it `exhausted`.
     */
    readonly start: (
      slideshow: Slideshow,
      plan: SlideshowPlan,
      rules: SlideshowStartRules
    ) => Effect.Effect<SlideshowStart>;
    /** How many jobs the workspace asked for since `since`. */
    readonly countSince: (
      workspaceId: WorkspaceId,
      since: DateTime.Utc
    ) => Effect.Effect<number>;
    readonly get: (
      workspaceId: WorkspaceId,
      id: SlideshowId
    ) => Effect.Effect<Option.Option<Slideshow>>;
    /** The job, whatever its workspace: for its run. */
    readonly find: (id: SlideshowId) => Effect.Effect<Option.Option<Slideshow>>;
    /** The workspace's jobs, newest first, `limit` at most. */
    readonly list: (
      workspaceId: WorkspaceId,
      status: Option.Option<SlideshowStatus>,
      limit: number
    ) => Effect.Effect<readonly Slideshow[]>;
    /**
     * Takes a queued job for its run, making it `running` and answering it
     * with its plan; none when it is not queued.
     */
    readonly claim: (
      id: SlideshowId,
      now: DateTime.Utc
    ) => Effect.Effect<Option.Option<ClaimedSlideshow>>;
    /**
     * Ends a job that is still on its way, its plan erased: the job as it
     * ended, or none when it had ended already.
     */
    readonly settle: (
      id: SlideshowId,
      outcome: SlideshowOutcome,
      now: DateTime.Utc
    ) => Effect.Effect<Option.Option<Slideshow>>;
  }
>()("peal-server/assistant/application/SlideshowStore") {}
