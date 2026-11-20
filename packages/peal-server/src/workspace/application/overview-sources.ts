import { Context } from "effect";
import type { DateTime, Effect } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/**
 * A workspace's posts that need someone: those going out in the next 7
 * days, those waiting for an approval, and those that finished in the last
 * 7 days with a channel that failed (`failed` and `partiallyPublished`, as
 * the posts' `outcome` filter names them) or one that may have it live
 * and must be checked (`unconfirmed`).
 */
export interface PostAttention {
  readonly awaitingApproval: number;
  readonly failedLast7Days: number;
  readonly scheduledNext7Days: number;
  readonly unconfirmedLast7Days: number;
}

/** A workspace's channels: how many, how many to reconnect, how many off. */
export interface ChannelStates {
  readonly connected: number;
  readonly off: number;
  readonly toReconnect: number;
}

/**
 * What a partner's overview of its customers reads of the other contexts,
 * a set of workspaces at a time: one read each, which answers a map by
 * workspace and leaves out a workspace with nothing. None checks a
 * permission: the overview decided which workspaces to name, and passes
 * only those whose sections the credential may read.
 */
export class OverviewSources extends Context.Service<
  OverviewSources,
  {
    readonly posts: (
      workspaceIds: readonly WorkspaceId[],
      now: DateTime.Utc
    ) => Effect.Effect<ReadonlyMap<WorkspaceId, PostAttention>, DatabaseError>;
    readonly channels: (
      workspaceIds: readonly WorkspaceId[]
    ) => Effect.Effect<ReadonlyMap<WorkspaceId, ChannelStates>, DatabaseError>;
    /** The threads with a comment waiting for an answer, by workspace. */
    readonly unanswered: (
      workspaceIds: readonly WorkspaceId[]
    ) => Effect.Effect<ReadonlyMap<WorkspaceId, number>, DatabaseError>;
    /**
     * Those of these workspaces that hold more than their plan allows, and
     * schedule nothing until they come back within it: the billing page's
     * standing (`mustReduce`), every member's to read.
     */
    readonly overPlan: (
      workspaceIds: readonly WorkspaceId[]
    ) => Effect.Effect<ReadonlySet<WorkspaceId>, DatabaseError>;
    /** Whether the server bills, without which nothing is over a plan. */
    readonly bills: boolean;
  }
>()("peal-server/workspace/application/OverviewSources") {}
