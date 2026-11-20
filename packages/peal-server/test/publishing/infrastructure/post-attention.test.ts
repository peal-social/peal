import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

import { PostAttention } from "#publishing/application/post-attention.ts";
import {
  SqlPostAttentionReads,
  weekStatements,
} from "#publishing/infrastructure/sql-post-attention-reads.ts";
import { newId } from "#shared/application/ids.ts";
import { PostIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { DatabaseTest, freshWorkspace } from "#test/channels/support.ts";

// What needs attention in several workspaces at once, and a workspace's
// week, in Postgres. The rows are workspaces of the test's own, at instants no other
// suite uses (2053), and deleted after: none is left scheduled.

const AttentionTest = PostAttention.layer.pipe(
  Layer.provide(SqlPostAttentionReads),
  Layer.provideMerge(DatabaseTest)
);

const utc = (iso: string) => DateTime.makeUnsafe(iso);

// The instant the counts are read at.
const now = utc("2053-03-10T12:00:00.000Z");

interface Row {
  readonly finishedAt?: string;
  readonly outcome?: string;
  readonly scheduledAt?: string;
  readonly status: string;
  readonly text?: string;
}

const instant = (iso: string | undefined) =>
  iso === undefined ? null : DateTime.toDateUtc(utc(iso));

const insert = Effect.fn("test.insert")(function* insert(
  workspaceId: WorkspaceId,
  row: Row
) {
  const sql = yield* SqlClient.SqlClient;
  const postId = yield* newId(PostIdSchema);

  yield* sql`INSERT INTO publishing.posts (id, workspace_id, status, text, scheduled_at, schedule_zone, finished_at, outcome) VALUES (${postId}, ${workspaceId}, ${row.status}, ${row.text ?? "A synthetic post"}, ${instant(row.scheduledAt)}, ${row.scheduledAt === undefined ? null : "Europe/Paris"}, ${instant(row.finishedAt)}, ${row.outcome ?? null})`;

  return postId;
});

const deleteAll = (workspaceIds: readonly WorkspaceId[]) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql`DELETE FROM publishing.posts WHERE workspace_id IN ${sql.in(workspaceIds)}`
  ).pipe(Effect.orDie);

// A post of a week, at its time.
const timed = (iso: string, status: string): Row => ({
  scheduledAt: iso,
  status,
  text: `Post at ${iso}`,
});

// A post of a week that ended at its time, as it did.
const ended = (iso: string, outcome: string): Row => ({
  finishedAt: iso,
  outcome,
  scheduledAt: iso,
  status: "finished",
  text: `Post at ${iso}`,
});

const finished = (outcome: string, finishedAt: string): Row => ({
  finishedAt,
  outcome,
  scheduledAt: "2053-03-01T09:00:00.000Z",
  status: "finished",
});

layer(AttentionTest)("posts needing attention across workspaces", (it) => {
  it.effect(
    "are counted per workspace, within 7 days on either side of now, and a workspace with none is left out",
    () =>
      Effect.gen(function* counted() {
        const first = yield* freshWorkspace;
        const second = yield* freshWorkspace;
        const empty = yield* freshWorkspace;

        const rows: readonly (readonly [WorkspaceId, Row])[] = [
          // Scheduled: now is included, 7 days from now is not.
          [
            first,
            { scheduledAt: "2053-03-10T12:00:00.000Z", status: "scheduled" },
          ],
          [
            first,
            { scheduledAt: "2053-03-17T11:59:59.999Z", status: "scheduled" },
          ],
          [
            first,
            { scheduledAt: "2053-03-17T12:00:00.000Z", status: "scheduled" },
          ],
          // Overdue, and not ahead: left to the job that publishes it.
          [
            first,
            { scheduledAt: "2053-03-10T11:59:59.999Z", status: "scheduled" },
          ],
          // Waiting for an approval, whatever its time.
          [
            first,
            {
              scheduledAt: "2053-03-01T09:00:00.000Z",
              status: "awaitingApproval",
            },
          ],
          [
            first,
            {
              scheduledAt: "2053-05-01T09:00:00.000Z",
              status: "awaitingApproval",
            },
          ],
          // Finished: 7 days ago is included, a moment before is not.
          [first, finished("failed", "2053-03-03T12:00:00.000Z")],
          [first, finished("partiallyPublished", "2053-03-09T08:00:00.000Z")],
          [first, finished("failed", "2053-03-03T11:59:59.999Z")],
          [first, finished("unconfirmed", "2053-03-08T08:00:00.000Z")],
          [first, finished("published", "2053-03-08T08:00:00.000Z")],
          [first, finished("cancelled", "2053-03-08T08:00:00.000Z")],
          // Not counted: a draft, a cancelled post, one publishing.
          [first, { status: "draft" }],
          [
            first,
            { scheduledAt: "2053-03-11T09:00:00.000Z", status: "cancelled" },
          ],
          [
            first,
            { scheduledAt: "2053-03-10T11:00:00.000Z", status: "publishing" },
          ],
          [
            second,
            { scheduledAt: "2053-03-12T09:00:00.000Z", status: "scheduled" },
          ],
          [second, finished("unconfirmed", "2053-03-10T11:00:00.000Z")],
          [second, finished("unconfirmed", "2053-03-10T12:00:00.000Z")],
        ];

        for (const [workspaceId, row] of rows) {
          yield* insert(workspaceId, row);
        }

        const counts = yield* PostAttention.use((attention) =>
          attention.countsIn([first, second, empty], now)
        ).pipe(Effect.ensuring(deleteAll([first, second])));

        assert.deepStrictEqual(counts.get(first), {
          awaitingApproval: 2,
          failedLast7Days: 2,
          scheduledNext7Days: 2,
          unconfirmedLast7Days: 1,
        });
        assert.deepStrictEqual(counts.get(second), {
          awaitingApproval: 0,
          failedLast7Days: 0,
          scheduledNext7Days: 1,
          unconfirmedLast7Days: 2,
        });
        assert.isFalse(counts.has(empty));
      })
  );

  it.effect(
    "give a workspace's week and the week after it, counted by each post's time, the first of each listed",
    () =>
      Effect.gen(function* week() {
        const workspaceId = yield* freshWorkspace;
        const other = yield* freshWorkspace;

        const rows: readonly Row[] = [
          // The week: from 6 October 2053 included to 13 October excluded.
          ended("2053-10-06T00:00:00.000Z", "published"),
          ended("2053-10-07T09:00:00.000Z", "partiallyPublished"),
          ended("2053-10-08T09:00:00.000Z", "published"),
          ended("2053-10-09T09:00:00.000Z", "failed"),
          ended("2053-10-10T09:00:00.000Z", "unconfirmed"),
          ended("2053-10-11T09:00:00.000Z", "cancelled"),
          // Before the week, a cancelled post and one still publishing.
          ended("2053-10-05T23:59:59.999Z", "published"),
          timed("2053-10-08T10:00:00.000Z", "cancelled"),
          timed("2053-10-12T23:00:00.000Z", "publishing"),
          // The week after: 13 October included, 20 October excluded.
          timed("2053-10-13T00:00:00.000Z", "scheduled"),
          timed("2053-10-14T09:00:00.000Z", "awaitingApproval"),
          timed("2053-10-15T09:00:00.000Z", "scheduled"),
          timed("2053-10-19T23:59:59.999Z", "scheduled"),
          timed("2053-10-20T00:00:00.000Z", "scheduled"),
        ];

        for (const row of rows) {
          yield* insert(workspaceId, row);
        }

        yield* insert(other, ended("2053-10-08T09:00:00.000Z", "published"));

        const found = yield* PostAttention.use((attention) =>
          attention.week(workspaceId, {
            from: utc("2053-10-06T00:00:00.000Z"),
            listed: 2,
            to: utc("2053-10-13T00:00:00.000Z"),
            until: utc("2053-10-20T00:00:00.000Z"),
          })
        ).pipe(Effect.ensuring(deleteAll([workspaceId, other])));

        assert.deepStrictEqual(found.counts, {
          awaitingApproval: 1,
          failed: 1,
          scheduled: 3,
          unconfirmed: 1,
          wentOut: 3,
        });
        assert.deepStrictEqual(
          found.wentOut.map(({ excerpt }) => excerpt),
          [
            "Post at 2053-10-06T00:00:00.000Z",
            "Post at 2053-10-07T09:00:00.000Z",
          ]
        );
        assert.deepStrictEqual(
          found.planned.map(({ scheduledAt }) =>
            DateTime.formatIso(scheduledAt)
          ),
          ["2053-10-13T00:00:00.000Z", "2053-10-14T09:00:00.000Z"]
        );
      })
  );

  // The digest reads one workspace's fortnight on the index of its posts
  // by time, whatever else the workspace keeps: a workspace with years of
  // posts reads the two weeks, never the years.
  it.effect(
    "read a week from the index of a workspace's posts by time, among years of posts",
    () =>
      Effect.gen(function* scale() {
        const sql = yield* SqlClient.SqlClient;
        const workspaceId = yield* freshWorkspace;

        // Three years of a post every two hours, before the week read.
        yield* sql`
          INSERT INTO publishing.posts (id, workspace_id, status, text, scheduled_at, schedule_zone, finished_at, outcome)
          SELECT gen_random_uuid(), ${workspaceId}, 'finished', 'A synthetic post', t, 'UTC', t, 'published'
          FROM generate_series(timestamptz '2050-01-01', timestamptz '2052-12-31', interval '2 hours') AS t
        `;
        yield* sql`ANALYZE publishing.posts`;

        const window = {
          from: utc("2053-10-06T00:00:00.000Z"),
          listed: 5,
          to: utc("2053-10-13T00:00:00.000Z"),
          until: utc("2053-10-20T00:00:00.000Z"),
        };

        const statements = weekStatements(sql, workspaceId, window);

        const plans = yield* Effect.forEach(
          [statements.counts, statements.wentOut, statements.planned],
          (statement) =>
            sql`EXPLAIN (FORMAT JSON) ${statement}`.pipe(
              Effect.map((rows) => JSON.stringify(rows))
            )
        ).pipe(Effect.ensuring(deleteAll([workspaceId])));

        for (const plan of plans) {
          assert.include(plan, "posts_workspace_scheduled_at");
          assert.notInclude(plan, "Seq Scan");
        }
      })
  );
});
