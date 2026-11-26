import { Schema } from "effect";

import { socialPlatforms } from "#shared/domain/platform.ts";
import type { Platform } from "#shared/domain/platform.ts";

import { followUpSupport } from "./follow-up-support.ts";

/**
 * Whether a rule's comment goes out on a platform, on this server: the
 * platform's support (`followUpSupport`), then whether the server sends a
 * post's later parts there (`turnedOff`: X's replies with `X_THREADS`)
 * and counts its likes (`notCounted`). No channel's own standing (a
 * reconnect, the comment's length) is in it. Answered by the API: add a
 * member, never rename or remove one.
 */
export const PlatformFollowUpCommentSchema = Schema.Literals([
  "available",
  "noApi",
  "review",
  "notBuilt",
  "notAllowed",
  "turnedOff",
  "notCounted",
]);

export type PlatformFollowUpComment = typeof PlatformFollowUpCommentSchema.Type;

/**
 * Whether a rule's repost goes out on a platform, on this server: the
 * platform's support, then whether the server counts its likes. No
 * channel's own standing (a Bluesky account that must grant reposts) is
 * in it. Answered by the API: add a member, never rename or remove one.
 */
export const PlatformFollowUpRepostSchema = Schema.Literals([
  "available",
  "noApi",
  "notBuilt",
  "notAllowed",
  "notCounted",
]);

export type PlatformFollowUpRepost = typeof PlatformFollowUpRepostSchema.Type;

/** What a rule can carry on a platform, before any channel's standing. */
export interface PlatformFollowUps {
  readonly comment: PlatformFollowUpComment;
  readonly platform: Platform;
  readonly repost: PlatformFollowUpRepost;
}

/** What the server does that a follow-up needs, platform by platform. */
export interface FollowUpServer {
  /** Whether Peal counts the likes of some channel's posts there. */
  readonly counts: (platform: Platform) => boolean;
  /** Whether the server sends a post's later parts there. */
  readonly takesParts: (platform: Platform) => boolean;
}

const commentOn = (
  platform: Platform,
  server: FollowUpServer
): PlatformFollowUpComment => {
  const support = followUpSupport[platform].comment;

  if (support !== "available") {
    return support;
  }

  if (!server.takesParts(platform)) {
    return "turnedOff";
  }

  return server.counts(platform) ? "available" : "notCounted";
};

const repostOn = (
  platform: Platform,
  server: FollowUpServer
): PlatformFollowUpRepost => {
  const support = followUpSupport[platform].repost;

  if (support !== "available") {
    return support;
  }

  return server.counts(platform) ? "available" : "notCounted";
};

/**
 * Where a rule may act on this server, for every platform in Peal's
 * order, kind by kind, as `followUpsOn` judges a channel before its own
 * standing: a channel there may still need connecting again, or take a
 * shorter comment.
 */
export const followUpsOnPlatforms = (
  server: FollowUpServer
): readonly PlatformFollowUps[] =>
  socialPlatforms.map((platform) => ({
    comment: commentOn(platform, server),
    platform,
    repost: repostOn(platform, server),
  }));
