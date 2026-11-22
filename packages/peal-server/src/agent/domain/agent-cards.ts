import { DateTime, Option } from "effect";
import type { Schema } from "effect";

import type {
  AgentApproval,
  AgentCard,
  AgentCardAction,
} from "./agent-parts.ts";
import { excerptOf, postOf, replyOf } from "./tool-items.ts";
import type { PostItem } from "./tool-items.ts";

// What each tool that makes or changes a post did to it, once it answered
// the post.
const postActions: ReadonlyMap<string, AgentCardAction> = new Map(
  Object.entries({
    cancel_post: "updated",
    create_draft: "created",
    duplicate_post: "created",
    publish_post: "published",
    queue_post: "scheduled",
    reschedule_post: "scheduled",
    schedule_post: "scheduled",
    tag_post: "updated",
    unschedule_post: "updated",
    update_draft: "updated",
  } satisfies Record<string, AgentCardAction>)
);

// The tools that answer a reply, or a comment they changed.
const threadActions: ReadonlyMap<string, AgentCardAction> = new Map(
  Object.entries({
    mark_comment_answered: "updated",
    moderate_comment: "updated",
    reply_to_comment: "replied",
    reply_to_location_review: "replied",
  } satisfies Record<string, AgentCardAction>)
);

// The tools that delete a post, or take it off its platforms, and answer
// no post: the card shows the post as the approval read it.
const deletingTools: ReadonlySet<string> = new Set([
  "discard_draft",
  "unpublish_post",
]);

const postCard = (post: PostItem, action: AgentCardAction): AgentCard => ({
  _tag: "post",
  action,
  channelIds: post.targets.map(({ channelId }) => channelId),
  excerpt: excerptOf(post.content.text),
  postId: post.id,
  scheduledAt: post.schedule === null ? null : post.schedule.at,
});

// A post made with a time goes out then; without one, at once.
const createdAction = (post: PostItem): AgentCardAction =>
  post.status === "draft" ? "created" : "scheduled";

const madeAction = (post: PostItem, now: DateTime.Utc): AgentCardAction =>
  post.schedule !== null && DateTime.isGreaterThan(post.schedule.at, now)
    ? createdAction(post)
    : "published";

/**
 * The card of what a tool that ran made or changed, from what it answered
 * (its JSON) and, for a deletion, from the approval the person gave;
 * none when the tool changes nothing a card shows, or answered something
 * else.
 */
export const cardOf = (
  tool: string,
  encodedResult: Schema.Json,
  approval: Option.Option<AgentApproval>,
  now: DateTime.Utc
): Option.Option<AgentCard> => {
  const action = postActions.get(tool);

  if (action !== undefined) {
    return postOf(encodedResult).pipe(
      Option.map((post) => postCard(post, action))
    );
  }

  if (tool === "create_post") {
    return postOf(encodedResult).pipe(
      Option.map((post) => postCard(post, madeAction(post, now)))
    );
  }

  const threadAction = threadActions.get(tool);

  if (threadAction !== undefined) {
    return replyOf(encodedResult).pipe(
      Option.map(({ text, threadId }): AgentCard => ({
        _tag: "thread",
        action: threadAction,
        excerpt: excerptOf(text),
        threadId,
      }))
    );
  }

  if (deletingTools.has(tool)) {
    return approval.pipe(
      Option.flatMap((asked) =>
        asked.postId === null
          ? Option.none()
          : Option.some<AgentCard>({
              _tag: "post",
              action: "deleted",
              channelIds: asked.channelIds,
              excerpt: excerptOf(asked.post?.text ?? asked.text ?? ""),
              postId: asked.postId,
              scheduledAt: null,
            })
      )
    );
  }

  return Option.none();
};
