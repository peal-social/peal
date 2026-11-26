import { Duration, Schema } from "effect";
import type { DateTime, Option } from "effect";

import type { PostExternalId } from "#publishing/domain/post-external-id.ts";
import type {
  PostOutcome,
  PostStatusName,
} from "#publishing/domain/post-status.ts";
import type { QueueId } from "#publishing/domain/queue-id.ts";
import type { RecyclingRuleId } from "#publishing/domain/recycling-rule-id.ts";
import type { TagId } from "#publishing/domain/tag-id.ts";
import { PostIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId, UserId, WorkspaceId } from "#shared/domain/ids.ts";

import type { FreshPost } from "./post-repository.ts";

/**
 * How a list of posts is ordered: by creation, by scheduled instant, or by
 * when each last changed, newest or oldest first. Posts without a time, as
 * drafts, are left out of a list ordered by scheduled instant.
 */
export const PostSortSchema = Schema.Literals([
  "createdDesc",
  "createdAsc",
  "scheduledDesc",
  "scheduledAsc",
  "updatedDesc",
  "updatedAsc",
]);

export type PostSort = typeof PostSortSchema.Type;

/** How a post's creator reached Peal (`PostOrigin`'s tags). */
export type PostOriginVia = "apiKey" | "application" | "web";

/** Which of a workspace's posts to list: every condition given holds. */
export interface PostFilter {
  readonly authorId: Option.Option<UserId>;
  /**
   * Posts with a target on one of these channels at least; an empty list
   * matches no post.
   */
  readonly channelIds: Option.Option<readonly ChannelId[]>;
  readonly createdVia: Option.Option<PostOriginVia>;
  /**
   * The posts that have this id of their caller's: one that is not
   * cancelled at most, and those cancelled that had it.
   */
  readonly externalId: Option.Option<PostExternalId>;
  readonly outcome: Option.Option<PostOutcome>;
  /** Posts that queue placed. */
  readonly queueId: Option.Option<QueueId>;
  /** Posts that recycling rule made. */
  readonly recyclingId: Option.Option<RecyclingRuleId>;
  /**
   * True: posts Peal deleted from at least one channel's platform; false:
   * posts deleted from none.
   */
  readonly removed: Option.Option<boolean>;
  /** Scheduled before this instant, excluded. */
  readonly scheduledBefore: Option.Option<DateTime.Utc>;
  /** Scheduled from this instant, included. */
  readonly scheduledFrom: Option.Option<DateTime.Utc>;
  readonly status: Option.Option<PostStatusName>;
  /**
   * Posts filed under one of these tags at least; an empty list matches
   * no post.
   */
  readonly tagIds: Option.Option<readonly TagId[]>;
  /** Posts that last changed at this instant or after it. */
  readonly updatedSince: Option.Option<DateTime.Utc>;
}

/**
 * How long a list ordered by change, oldest first (`updatedAsc`), holds
 * back the posts that just changed. A transaction that read the clock and
 * has not committed yet would otherwise land behind a cursor already
 * given, and a sync that walks the list would never read it: holding back
 * the last seconds makes a walk show a change late, maybe twice, never not
 * at all, as long as no transaction takes longer between its write and its
 * commit. Those that call a platform while they hold a post's row (a
 * draft's scheduling asks the accounts' own rules) write the post once the
 * answer came, just before they commit; a statement that waited on that
 * row writes the instant it wrote at (`moved`).
 */
export const updateSettle = Duration.seconds(5);

/**
 * Where a page ended: its last post, and the instant that post is
 * scheduled at when the list is ordered by it, or when it last changed
 * when the list is ordered by that (`updatedAt`, which cursors given
 * before it existed lack). Ids are UUIDv7s, so the id alone orders posts by
 * creation, and breaks ties between posts at the same instant: a page
 * never repeats nor skips a post, whatever is created or moved meanwhile.
 * Persisted contract for as long as clients keep cursors: add optional
 * keys only.
 */
export const PostPositionSchema = Schema.Struct({
  postId: PostIdSchema,
  scheduledAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
  sort: PostSortSchema,
  updatedAt: Schema.optionalKey(Schema.DateTimeUtcFromMillis),
});

export type PostPosition = typeof PostPositionSchema.Type;

/** A page of a workspace's posts to read. */
export interface PostPageRequest {
  /** The position the page before ended at, if this is not the first. */
  readonly after: Option.Option<PostPosition>;
  /**
   * When the request was read: a list ordered by change, oldest first,
   * holds back the posts changed within `updateSettle` of it.
   */
  readonly asOf: DateTime.Utc;
  readonly filter: PostFilter;
  readonly limit: number;
  readonly sort: PostSort;
  readonly workspaceId: WorkspaceId;
}

/** A page of posts, in the order asked. */
export interface StoredPostPage {
  readonly items: readonly FreshPost[];
  /** Where the next page starts, if there is one. */
  readonly next: Option.Option<PostPosition>;
}
