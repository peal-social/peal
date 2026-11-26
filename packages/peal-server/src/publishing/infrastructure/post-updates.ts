import { inArray, sql } from "drizzle-orm";
import { DateTime, Effect } from "effect";

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
 * the clock in the other order than they commit, and a walker's cursor
 * never ends up past a change it has not read. Instants are kept in whole
 * milliseconds, as cursors hold them.
 */
export const moved = (now: DateTime.Utc) =>
  sql`GREATEST(${posts.updatedAt} + interval '1 millisecond', ${DateTime.toDateUtc(now).toISOString()}::timestamptz)`;

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
