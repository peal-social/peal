import { Context } from "effect";
import type { DateTime, Effect, Option } from "effect";

import type {
  VideoFailureReason,
  VideoGeneration,
  VideoGenerationId,
  VideoPrompt,
  VideoStatus,
} from "#assistant/domain/video-generation.ts";
import type { MediaAssetId, WorkspaceId } from "#shared/domain/ids.ts";

/** What a new job is held to as it is recorded. */
export interface VideoStartRules {
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
export type VideoStart =
  | {
      readonly _tag: "started";
      readonly interrupted: readonly VideoGeneration[];
    }
  | { readonly _tag: "busy"; readonly generationId: VideoGenerationId }
  | { readonly _tag: "exhausted" };

/** How a job ended. */
export type VideoOutcome =
  | { readonly _tag: "succeeded"; readonly mediaId: MediaAssetId }
  | { readonly _tag: "failed"; readonly reason: VideoFailureReason };

/** A job its run took: the job, now `running`, and its prompt. */
export interface ClaimedVideo {
  readonly generation: VideoGeneration;
  readonly prompt: VideoPrompt;
}

/**
 * The videos workspaces asked for, one row a job (`assistant.video_generations`),
 * the prompt kept beside it only until the job ends. A database failure is
 * a defect.
 */
export class VideoGenerationStore extends Context.Service<
  VideoGenerationStore,
  {
    /**
     * Records a queued job with its prompt, under the workspace's rules, in
     * the caller's transaction: first the workspace's jobs still on their
     * way since before `staleBefore` fail `interrupted`, then one still on
     * its way makes it `busy` (the database's unique index decides, so two
     * requests together never both start), then `dailyLimit` jobs since
     * `dayStart` make it `exhausted`.
     */
    readonly start: (
      generation: VideoGeneration,
      prompt: VideoPrompt,
      rules: VideoStartRules
    ) => Effect.Effect<VideoStart>;
    /** How many jobs the workspace asked for since `since`. */
    readonly countSince: (
      workspaceId: WorkspaceId,
      since: DateTime.Utc
    ) => Effect.Effect<number>;
    readonly get: (
      workspaceId: WorkspaceId,
      id: VideoGenerationId
    ) => Effect.Effect<Option.Option<VideoGeneration>>;
    /** The job, whatever its workspace: for its run. */
    readonly find: (
      id: VideoGenerationId
    ) => Effect.Effect<Option.Option<VideoGeneration>>;
    /** The workspace's jobs, newest first, `limit` at most. */
    readonly list: (
      workspaceId: WorkspaceId,
      status: Option.Option<VideoStatus>,
      limit: number
    ) => Effect.Effect<readonly VideoGeneration[]>;
    /**
     * Takes a queued job for its run, making it `running` and answering it
     * with its prompt; none when it is not queued (a run found it started
     * before, or ended).
     */
    readonly claim: (
      id: VideoGenerationId,
      now: DateTime.Utc
    ) => Effect.Effect<Option.Option<ClaimedVideo>>;
    /**
     * Ends a job that is still on its way (queued or running), its prompt
     * erased: the job as it ended, or none when it had ended already.
     */
    readonly settle: (
      id: VideoGenerationId,
      outcome: VideoOutcome,
      now: DateTime.Utc
    ) => Effect.Effect<Option.Option<VideoGeneration>>;
  }
>()("peal-server/assistant/application/VideoGenerationStore") {}
