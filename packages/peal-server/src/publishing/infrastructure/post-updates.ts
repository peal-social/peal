import { asc, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { PostIdSchema } from "#shared/domain/ids.ts";
import type { PostId } from "#shared/domain/ids.ts";
import type { Drizzle } from "#shared/infrastructure/database.ts";

import { posts } from "./schema.ts";

// When a post last changed (`posts.updated_at`): what a sync walks, so
// every statement that writes a column a post's answer shows, its targets'
// included, moves it. Statements that write what no answer shows (the job's
// execution id, the content digest, the first-comment mark) leave it.
// `test/publishing/infrastructure/post-updates.test.ts` reads every write
// of `posts` and `post_targets` and fails on one in neither list.

/**
 * `updated_at` as a statement that writes `posts` sets it: `now`, or a
 * millisecond past what the row holds when that is later. So a post moves
 * forward with each change, never back, even when two transactions read
 * the clock in the other order than they commit. Read `now` once the rows
 * are locked: Postgres computes a statement's values before it waits on a
 * row another transaction holds, and keeps them when that row did not
 * change, so a write that waits would land behind its own commit, where
 * the walk's hold-back (`updateSettle`) may have passed it. A write of one
 * post holds its row already (`PostRepository.lock`); a write of several
 * locks them first (`lockedPosts`). Instants are kept in whole
 * milliseconds, as cursors hold them.
 */
export const moved = (now: DateTime.Utc) =>
  sql`GREATEST(${posts.updatedAt} + interval '1 millisecond', ${DateTime.toDateUtc(now).toISOString()}::timestamptz)`;

/**
 * Locks the posts that match, in id order (as every other lock of several
 * posts takes them), until the transaction ends, and answers their ids: a
 * write of several posts calls it first, then reads the clock, then writes
 * `moved(now)` to these ids alone, passed as one parameter (`anyUuid`), as
 * a statement takes 65,535 at most and a tag may file more posts.
 */
export const lockedPosts = (
  db: Drizzle["Service"],
  condition: SQL | undefined
) =>
  db
    .select({ id: posts.id })
    .from(posts)
    .where(condition)
    .orderBy(asc(posts.id))
    .for("update")
    .pipe(Effect.map((rows) => rows.map(({ id }) => PostIdSchema.make(id))));

/**
 * Moves the posts' `updated_at` as `moved` does, for a statement that
 * writes their targets (`post_targets`): a target that publishes, fails or
 * is taken off changes what its post's answer shows.
 */
export const movePosts = (db: Drizzle["Service"], postIds: readonly PostId[]) =>
  postIds.length === 0
    ? Effect.void
    : DateTime.now.pipe(
        Effect.flatMap((now) =>
          db
            .update(posts)
            .set({ updatedAt: moved(now) })
            .where(inArray(posts.id, [...new Set(postIds)]))
        ),
        Effect.asVoid
      );
