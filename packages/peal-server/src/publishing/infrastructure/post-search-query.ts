import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { DateTime, Option } from "effect";

import { updateSettle } from "#publishing/application/post-listing.ts";
import type {
  PostPageRequest,
  PostPosition,
  PostSort,
} from "#publishing/application/post-listing.ts";
import { PostIdSchema } from "#shared/domain/ids.ts";

import { posts, postTargets } from "./schema.ts";

// The conditions and the order of a page of posts (`PostRepository.search`).
// Pages are keyed on (scheduled_at, id), on (updated_at, id) or on id alone,
// never on an offset, so a page starts where the one before ended whatever
// was created, moved or deleted meanwhile.

const date = (instant: DateTime.Utc) => DateTime.toDateUtc(instant);

const byScheduled = (sort: PostSort) =>
  sort === "scheduledAsc" || sort === "scheduledDesc";

const byUpdated = (sort: PostSort) =>
  sort === "updatedAsc" || sort === "updatedDesc";

const descending = (sort: PostSort) =>
  sort === "createdDesc" || sort === "scheduledDesc" || sort === "updatedDesc";

// The posts past the position, in the list's order.
const past = (
  sort: PostSort,
  { postId, scheduledAt, updatedAt }: PostPosition
) => {
  const further = descending(sort) ? lt : gt;

  // A list by change keys on when each post changed, which a position of
  // that list always holds.
  if (byUpdated(sort) && updatedAt !== undefined) {
    const at = date(updatedAt);

    return or(
      further(posts.updatedAt, at),
      and(eq(posts.updatedAt, at), further(posts.id, postId))
    );
  }

  if (!byScheduled(sort) || scheduledAt === null) {
    return further(posts.id, postId);
  }

  const at = date(scheduledAt);

  return or(
    further(posts.scheduledAt, at),
    and(eq(posts.scheduledAt, at), further(posts.id, postId))
  );
};

/** Where a page whose last post is `row` ended, in the list's order. */
export const positionOf = (
  row: {
    readonly id: string;
    readonly scheduledAt: Date | null;
    readonly updatedAt: Date;
  },
  sort: PostSort
): PostPosition => {
  const position: PostPosition = {
    postId: PostIdSchema.make(row.id),
    scheduledAt:
      row.scheduledAt === null ? null : DateTime.makeUnsafe(row.scheduledAt),
    sort,
  };

  return byUpdated(sort)
    ? { ...position, updatedAt: DateTime.makeUnsafe(row.updatedAt) }
    : position;
};

const some = <A, B>(option: Option.Option<A>, condition: (value: A) => B) =>
  option.pipe(Option.map(condition), Option.getOrUndefined);

/** What a post must hold to be on the page. */
export const pageConditions = ({
  after,
  asOf,
  filter,
  sort,
  workspaceId,
}: PostPageRequest) =>
  and(
    eq(posts.workspaceId, workspaceId),
    // A list ordered by time holds the posts that have one.
    byScheduled(sort) ? isNotNull(posts.scheduledAt) : undefined,
    // A walk by change, oldest first, never reads a post that changed in
    // the last seconds (`updateSettle`): a change not committed yet cannot
    // then land behind a cursor already given.
    sort === "updatedAsc"
      ? lte(
          posts.updatedAt,
          date(DateTime.subtractDuration(asOf, updateSettle))
        )
      : undefined,
    some(filter.externalId, (externalId) => eq(posts.externalId, externalId)),
    some(filter.updatedSince, (since) => gte(posts.updatedAt, date(since))),
    some(filter.status, (status) => eq(posts.status, status)),
    some(filter.outcome, (outcome) => eq(posts.outcome, outcome)),
    some(filter.authorId, (authorId) => eq(posts.authorId, authorId)),
    some(filter.queueId, (queueId) => eq(posts.queueId, queueId)),
    some(filter.recyclingId, (ruleId) => eq(posts.recyclingId, ruleId)),
    some(filter.removed, (removed) =>
      removed
        ? sql`EXISTS (SELECT 1 FROM ${postTargets} WHERE ${postTargets.postId} = ${posts.id} AND ${postTargets.removedAt} IS NOT NULL)`
        : sql`NOT EXISTS (SELECT 1 FROM ${postTargets} WHERE ${postTargets.postId} = ${posts.id} AND ${postTargets.removedAt} IS NOT NULL)`
    ),
    some(
      filter.createdVia,
      (via) => sql`${posts.createdVia} ->> '_tag' = ${via}`
    ),
    some(filter.scheduledFrom, (from) => gte(posts.scheduledAt, date(from))),
    some(filter.scheduledBefore, (before) =>
      lt(posts.scheduledAt, date(before))
    ),
    some(
      filter.channelIds,
      (channelIds) =>
        // A channel taken off the post is none of its channels.
        sql`EXISTS (SELECT 1 FROM ${postTargets} WHERE ${postTargets.postId} = ${posts.id} AND NOT ${postTargets.dropped} AND ${inArray(postTargets.channelId, [...channelIds])})`
    ),
    some(
      filter.tagIds,
      (tagIds) =>
        sql`${posts.tagIds} && ARRAY[${sql.join(
          tagIds.map((tagId) => sql`${tagId}`),
          sql`, `
        )}]::uuid[]`
    ),
    some(after, (position) => past(sort, position))
  );

/**
 * The order of the page: by time then id, by change then id, or by id,
 * which is by creation.
 */
export const pageOrder = (sort: PostSort) => {
  const direction = descending(sort) ? desc : asc;

  if (byUpdated(sort)) {
    return [direction(posts.updatedAt), direction(posts.id)];
  }

  return byScheduled(sort)
    ? [direction(posts.scheduledAt), direction(posts.id)]
    : [direction(posts.id)];
};
