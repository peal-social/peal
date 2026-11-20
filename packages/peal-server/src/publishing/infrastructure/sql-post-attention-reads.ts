import { DateTime, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { PostAttentionReads } from "#publishing/application/post-attention-reads.ts";
import type {
  AttentionCounts,
  WeekWindow,
} from "#publishing/application/post-attention-reads.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { PostIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

const failed = (cause: unknown) => new DatabaseError({ cause });

// The outcomes that say a channel failed, as the posts' `outcome` filter
// names them: none went out, or some did and others failed.
const decodeCounts = Schema.decodeUnknownEffect(
  Schema.Array(
    Schema.Struct({
      awaitingApproval: Schema.Int,
      failedLast7Days: Schema.Int,
      scheduledNext7Days: Schema.Int,
      unconfirmedLast7Days: Schema.Int,
      workspaceId: WorkspaceIdSchema,
    })
  )
);

// Every workspace's id in one text parameter, split in the database, as
// `anyUuid` writes it: a statement takes 65,535 parameters at most.
const idsOf = (workspaceIds: readonly WorkspaceId[]) => workspaceIds.join(",");

// How much of a post's text the query reads: enough for the excerpt the
// domain cuts, which counts characters as a reader does, never the whole
// of a long text.
const textRead = 600;

const decodeWeekCounts = Schema.decodeUnknownEffect(
  Schema.Tuple([
    Schema.Struct({
      awaitingApproval: Schema.Int,
      failed: Schema.Int,
      scheduled: Schema.Int,
      unconfirmed: Schema.Int,
      wentOut: Schema.Int,
    }),
  ])
);

const decodeWeekPosts = Schema.decodeUnknownEffect(
  Schema.Array(
    Schema.Struct({
      postId: PostIdSchema,
      scheduledAt: Schema.DateTimeUtcFromDate,
      textStart: Schema.String,
    })
  )
);

/**
 * The statements of a workspace's week, each a range of the index of its
 * posts by time (`posts_workspace_scheduled_at`) over the fortnight at
 * most, whatever else it keeps: the counts, then the first posts that
 * went out in the week, then the first going out in the week after.
 */
export const weekStatements = (
  client: SqlClient.SqlClient,
  workspaceId: WorkspaceId,
  { from, listed, to, until }: WeekWindow
) => {
  const start = DateTime.toDateUtc(from);
  const middle = DateTime.toDateUtc(to);
  const end = DateTime.toDateUtc(until);

  return {
    counts: client`
      SELECT
        (count(*) FILTER (WHERE scheduled_at < ${middle} AND status = 'finished' AND outcome IN ('published', 'partiallyPublished')))::int AS "wentOut",
        (count(*) FILTER (WHERE scheduled_at < ${middle} AND status = 'finished' AND outcome = 'failed'))::int AS "failed",
        (count(*) FILTER (WHERE scheduled_at < ${middle} AND status = 'finished' AND outcome = 'unconfirmed'))::int AS "unconfirmed",
        (count(*) FILTER (WHERE scheduled_at >= ${middle} AND status = 'scheduled'))::int AS "scheduled",
        (count(*) FILTER (WHERE scheduled_at >= ${middle} AND status = 'awaitingApproval'))::int AS "awaitingApproval"
      FROM publishing.posts
      WHERE workspace_id = ${workspaceId}
        AND scheduled_at >= ${start}
        AND scheduled_at < ${end}
    `,
    planned: client`
      SELECT id AS "postId", scheduled_at AS "scheduledAt", left(text, ${textRead}) AS "textStart"
      FROM publishing.posts
      WHERE workspace_id = ${workspaceId}
        AND status IN ('scheduled', 'awaitingApproval')
        AND scheduled_at >= ${middle}
        AND scheduled_at < ${end}
      ORDER BY scheduled_at, id
      LIMIT ${listed}
    `,
    wentOut: client`
      SELECT id AS "postId", scheduled_at AS "scheduledAt", left(text, ${textRead}) AS "textStart"
      FROM publishing.posts
      WHERE workspace_id = ${workspaceId}
        AND status = 'finished'
        AND outcome IN ('published', 'partiallyPublished')
        AND scheduled_at >= ${start}
        AND scheduled_at < ${middle}
      ORDER BY scheduled_at, id
      LIMIT ${listed}
    `,
  };
};

/**
 * The counts across workspaces, in Postgres, in one statement, every
 * workspace's id in one parameter, each part on an index that bounds what
 * it reads, and a workspace's week for its digest.
 */
export const SqlPostAttentionReads = Layer.effect(
  PostAttentionReads,
  Effect.gen(function* SqlPostAttentionReads() {
    const client = yield* SqlClient.SqlClient;

    return PostAttentionReads.of({
      // One read an index serves for each thing counted, put together:
      // the posts going out by their time (`posts_workspace_scheduled_at`),
      // those waiting for an approval (`posts_workspace_awaiting_approval`)
      // and those that ended failed or to check by when they ended
      // (`posts_workspace_finished_attention`), so the cost follows what
      // is counted, never how many posts a workspace keeps.
      countsIn: (
        workspaceIds,
        { finishedFrom, scheduledFrom, scheduledTo }
      ) => {
        const ids = idsOf(workspaceIds);

        return client`
          SELECT
            workspace_id AS "workspaceId",
            (count(*) FILTER (WHERE kind = 'scheduled'))::int AS "scheduledNext7Days",
            (count(*) FILTER (WHERE kind = 'awaiting'))::int AS "awaitingApproval",
            (count(*) FILTER (WHERE kind = 'finished' AND outcome IN ('failed', 'partiallyPublished')))::int AS "failedLast7Days",
            (count(*) FILTER (WHERE kind = 'finished' AND outcome = 'unconfirmed'))::int AS "unconfirmedLast7Days"
          FROM (
            SELECT workspace_id, 'scheduled' AS kind, NULL::text AS outcome
            FROM publishing.posts
            WHERE workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])
              AND status = 'scheduled'
              AND scheduled_at >= ${DateTime.toDateUtc(scheduledFrom)}
              AND scheduled_at < ${DateTime.toDateUtc(scheduledTo)}
            UNION ALL
            SELECT workspace_id, 'awaiting', NULL
            FROM publishing.posts
            WHERE workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])
              AND status = 'awaitingApproval'
            UNION ALL
            SELECT workspace_id, 'finished', outcome
            FROM publishing.posts
            WHERE workspace_id = ANY(string_to_array(${ids}, ',')::uuid[])
              AND status = 'finished'
              AND outcome IN ('failed', 'partiallyPublished', 'unconfirmed')
              AND finished_at >= ${DateTime.toDateUtc(finishedFrom)}
          ) AS attention
          GROUP BY workspace_id
        `.pipe(
          Effect.mapError(failed),
          Effect.flatMap((rows) => decodeCounts(rows).pipe(Effect.orDie)),
          Effect.map(
            (rows) =>
              new Map(
                rows.map(
                  ({
                    workspaceId,
                    ...counts
                  }): readonly [WorkspaceId, AttentionCounts] => [
                    workspaceId,
                    counts,
                  ]
                )
              )
          ),
          Effect.withSpan("PostAttentionReads.countsIn")
        );
      },
      week: (workspaceId, window) => {
        const statements = weekStatements(client, workspaceId, window);

        return Effect.all({
          counts: statements.counts.pipe(
            Effect.flatMap((rows) => decodeWeekCounts(rows).pipe(Effect.orDie)),
            Effect.map(([counts]) => counts)
          ),
          planned: statements.planned.pipe(
            Effect.flatMap((rows) => decodeWeekPosts(rows).pipe(Effect.orDie))
          ),
          wentOut: statements.wentOut.pipe(
            Effect.flatMap((rows) => decodeWeekPosts(rows).pipe(Effect.orDie))
          ),
        }).pipe(
          Effect.mapError(failed),
          Effect.withSpan("PostAttentionReads.week")
        );
      },
    });
  })
);
