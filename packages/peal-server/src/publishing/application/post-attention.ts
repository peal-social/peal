import { Context, DateTime, Effect, Layer } from "effect";

import { excerptOf } from "#publishing/domain/post-excerpt.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

import { PostAttentionReads } from "./post-attention-reads.ts";
import type {
  AttentionCounts,
  StoredWeekPost,
  WeekPost,
  WeekWindow,
  WorkspaceWeek,
} from "./post-attention-reads.ts";

export type {
  AttentionCounts,
  WeekCounts,
  WeekPost,
  WeekWindow,
  WorkspaceWeek,
} from "./post-attention-reads.ts";

const weekPostOf = ({ textStart, ...post }: StoredWeekPost): WeekPost => ({
  ...post,
  excerpt: excerptOf(textStart),
});

/**
 * The posts of several workspaces at once: what needs attention in each,
 * counted, for a partner's view of its customers, and one workspace's week
 * for a member's digest. Counts and excerpts only, so it checks no
 * permission: the caller decided which workspaces may be read, and names
 * only those.
 */
export class PostAttention extends Context.Service<
  PostAttention,
  {
    /** Each workspace's counts; one with nothing to count is left out. */
    readonly countsIn: (
      workspaceIds: readonly WorkspaceId[],
      now: DateTime.Utc
    ) => Effect.Effect<
      ReadonlyMap<WorkspaceId, AttentionCounts>,
      DatabaseError
    >;
    /**
     * One workspace's week and the week after it, by the time each post
     * had: counted, and the first `listed` of each, for a digest.
     */
    readonly week: (
      workspaceId: WorkspaceId,
      window: WeekWindow
    ) => Effect.Effect<WorkspaceWeek<WeekPost>, DatabaseError>;
  }
>()("peal-server/publishing/application/PostAttention") {
  static readonly layer = Layer.effect(
    PostAttention,
    Effect.gen(function* PostAttentionLive() {
      const reads = yield* PostAttentionReads;

      return PostAttention.of({
        countsIn: (workspaceIds, now) =>
          (workspaceIds.length === 0
            ? Effect.succeed(new Map<WorkspaceId, AttentionCounts>())
            : reads.countsIn(workspaceIds, {
                finishedFrom: DateTime.subtract(now, { days: 7 }),
                scheduledFrom: now,
                scheduledTo: DateTime.add(now, { days: 7 }),
              })
          ).pipe(Effect.withSpan("PostAttention.countsIn")),
        week: (workspaceId, window) =>
          reads.week(workspaceId, window).pipe(
            Effect.map(({ counts, planned, wentOut }) => ({
              counts,
              planned: planned.map(weekPostOf),
              wentOut: wentOut.map(weekPostOf),
            })),
            Effect.withSpan("PostAttention.week")
          ),
      });
    })
  );
}
