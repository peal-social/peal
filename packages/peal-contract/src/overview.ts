import { Schema } from "effect";

/**
 * Why a workspace shows no figure: it requires two-step verification, and
 * the person's account does not have it on (`twoStepRequired`).
 */
// One reason for now: a list of one would be written as a union of one.
export const OverviewRefusalSchema = Schema.Literal("twoStepRequired").annotate(
  { identifier: "OverviewRefusal" }
);

export type OverviewRefusal = typeof OverviewRefusalSchema.Type;

/**
 * A workspace's posts that need someone: going out in the next 7 days,
 * waiting for an approval, and finished in the last 7 days with a channel
 * that failed (the outcomes `failed` and `partiallyPublished`) or one that
 * may have it live and must be checked (`unconfirmed`). `mayApprove` says
 * whether the caller may approve those that wait.
 */
export const OverviewPostsSchema = Schema.Struct({
  awaitingApproval: Schema.Int,
  failedLast7Days: Schema.Int,
  mayApprove: Schema.Boolean,
  scheduledNext7Days: Schema.Int,
  unconfirmedLast7Days: Schema.Int,
}).annotate({ identifier: "OverviewPosts" });

export type OverviewPosts = typeof OverviewPostsSchema.Type;

/** A workspace's channels, those to reconnect, and those turned off. */
export const OverviewChannelsSchema = Schema.Struct({
  connected: Schema.Int,
  off: Schema.Int,
  toReconnect: Schema.Int,
}).annotate({ identifier: "OverviewChannels" });

export type OverviewChannels = typeof OverviewChannelsSchema.Type;

/** The threads of a workspace's inbox with a comment waiting for an answer. */
export const OverviewInboxSchema = Schema.Struct({
  unanswered: Schema.Int,
}).annotate({ identifier: "OverviewInbox" });

export type OverviewInbox = typeof OverviewInboxSchema.Type;
