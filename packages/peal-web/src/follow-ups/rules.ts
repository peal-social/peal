import { Option } from "effect";
import type {
  Channel,
  FollowUpRule,
  NewFollowUpRule,
  PlatformFollowUps,
  Post,
} from "peal-contract";

/**
 * What a rule can send on a post, as the server says where rules act
 * (`automations.followUps.platforms`): a comment, a repost, or both;
 * none where no channel of the post is on a platform that takes either.
 */
export type FollowUpOffer = "both" | "comment" | "repost" | "none";

/**
 * The channels a rule would act on: those the post is on its way to or
 * live on. Cancelled, failed, unconfirmed and removed ones never are.
 */
const followedChannelIds = (post: Pick<Post, "targets">): ReadonlySet<string> =>
  new Set(
    post.targets.flatMap((target) =>
      (target.status === "pending" ||
        target.status === "publishing" ||
        target.status === "published") &&
      target.removedAt === null
        ? [target.channelId]
        : []
    )
  );

/**
 * What a rule may send on the post's channels: the kinds the server says
 * act on at least one of their platforms. The server still judges each
 * channel's own standing (a reconnect, the comment's length).
 */
export const followUpOfferOn = (
  post: Pick<Post, "targets">,
  channels: readonly Pick<Channel, "id" | "platform">[],
  platforms: readonly PlatformFollowUps[]
): FollowUpOffer => {
  const followed = followedChannelIds(post);

  const onPost = new Set<string>(
    channels.flatMap(({ id, platform }) => (followed.has(id) ? [platform] : []))
  );

  const acting = platforms.filter(({ platform }) => onPost.has(platform));
  const comment = acting.some((each) => each.comment === "available");
  const repost = acting.some((each) => each.repost === "available");

  if (comment && repost) {
    return "both";
  }

  if (comment) {
    return "comment";
  }

  return repost ? "repost" : "none";
};

/** What the form holds while a member writes a rule. */
export interface FollowUpDraft {
  readonly comment: string;
  readonly likes: string;
  readonly repost: boolean;
}

export const freshFollowUp: FollowUpDraft = {
  comment: "",
  likes: "50",
  repost: false,
};

const likesPattern = /^\d{1,7}$/u;

/**
 * The request the form sends for a post, or why not: likes that are not a
 * whole number (`likes`), or nothing to do (`nothing`). The server checks
 * the rest.
 */
export const followUpRequestOf = (
  postId: string,
  draft: FollowUpDraft
): Option.Option<NewFollowUpRule> | "likes" | "nothing" => {
  const comment = draft.comment.trim();

  if (!likesPattern.test(draft.likes.trim())) {
    return "likes";
  }

  if (comment.length === 0 && !draft.repost) {
    return "nothing";
  }

  const likes = Number(draft.likes.trim());

  return Option.some(
    comment.length === 0
      ? { likes, postId, repost: draft.repost }
      : { comment, likes, postId, repost: draft.repost }
  );
};

/** The rule of a post that has not ended, if one has. */
export const ruleOfPost = (
  rules: readonly FollowUpRule[],
  postId: string
): FollowUpRule | undefined =>
  rules.find((rule) => rule.postId === postId && rule.status !== "ended");
