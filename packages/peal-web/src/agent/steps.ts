// What a step or a change of the agent's is about, from its tool's name
// (the MCP endpoint's), so the chat names it in the reader's language:
// `Agent.steps.<kind>` while it runs and once done, `Agent.approval.<kind>`
// on a change that waits. A tool this list does not know is `other`.

export type StepKind =
  | "analytics"
  | "approvals"
  | "channels"
  | "comments"
  | "deleting"
  | "drafting"
  | "editing"
  | "inbox"
  | "media"
  | "messages"
  | "messaging"
  | "moderating"
  | "other"
  | "posts"
  | "publishing"
  | "queues"
  | "replying"
  | "reviewing"
  | "reviews"
  | "saved"
  | "scheduling"
  | "tagCreating"
  | "tagging"
  | "tags"
  | "unpublishing"
  | "workspace";

const byTool = new Map<string, StepKind>([
  ["analytics_dashboard", "analytics"],
  ["analytics_summary", "analytics"],
  ["approve_post", "reviewing"],
  ["best_times", "analytics"],
  ["cancel_post", "deleting"],
  ["channel_analytics", "analytics"],
  ["create_draft", "drafting"],
  ["create_post", "scheduling"],
  ["create_tag", "tagCreating"],
  ["discard_draft", "deleting"],
  ["duplicate_post", "drafting"],
  ["edit_published_post", "editing"],
  ["get_comment_thread", "comments"],
  ["get_conversation", "messages"],
  ["get_location_reviews", "reviews"],
  ["get_post_review", "approvals"],
  ["list_approvals", "approvals"],
  ["list_channel_sets", "saved"],
  ["list_comment_threads", "comments"],
  ["list_conversations", "messages"],
  ["list_location_reviews", "reviews"],
  ["list_signatures", "saved"],
  ["mark_comment_answered", "moderating"],
  ["moderate_comment", "moderating"],
  ["post_analytics", "analytics"],
  ["publish_post", "publishing"],
  ["queue_post", "scheduling"],
  ["remove_post_target", "deleting"],
  ["reply_to_comment", "replying"],
  ["reply_to_location_review", "replying"],
  ["request_changes", "reviewing"],
  ["reschedule_post", "scheduling"],
  ["schedule_post", "scheduling"],
  ["send_message", "messaging"],
  ["send_private_reply", "messaging"],
  ["tag_post", "tagging"],
  ["unpublish_post", "unpublishing"],
  ["unschedule_post", "scheduling"],
  ["update_draft", "drafting"],
  ["whoami", "workspace"],
]);

// What a reading tool reads, from the words of its name.
const bySubject: readonly (readonly [RegExp, StepKind])[] = [
  [/post|draft/u, "posts"],
  [/channel/u, "channels"],
  [/media/u, "media"],
  [/queue/u, "queues"],
  [/tag/u, "tags"],
  [/signature|channel_set/u, "saved"],
  [/analytic|report|usage/u, "analytics"],
  [/comment|thread/u, "comments"],
  [/inbox/u, "inbox"],
  [/workspace|member/u, "workspace"],
];

/** What a tool's step is about, for the words that name it. */
export const stepKindOf = (tool: string): StepKind => {
  const known = byTool.get(tool);

  if (known !== undefined) {
    return known;
  }

  if (/^(?:list|get|search|find|preview)_/u.test(tool)) {
    return bySubject.find(([pattern]) => pattern.test(tool))?.[1] ?? "other";
  }

  return "other";
};

/** What a change that waits for the person does, for its card's title. */
export type ApprovalKind =
  | "approve"
  | "delete"
  | "edit"
  | "message"
  | "moderate"
  | "move"
  | "other"
  | "publish"
  | "queue"
  | "reply"
  | "requestChanges"
  | "schedule"
  | "tag"
  | "unpublish"
  | "unschedule";

const approvalKinds: Partial<Record<StepKind, ApprovalKind>> = {
  deleting: "delete",
  editing: "edit",
  messaging: "message",
  moderating: "moderate",
  publishing: "publish",
  replying: "reply",
  scheduling: "schedule",
  tagCreating: "tag",
  unpublishing: "unpublish",
};

// Changes to a scheduled post's time, each said in its own words.
const postMoves = new Map<string, ApprovalKind>([
  ["queue_post", "queue"],
  ["reschedule_post", "move"],
  ["unschedule_post", "unschedule"],
]);

/**
 * What a change's tool does, as the approval card says it: a post made
 * with no time goes out at once.
 */
export const approvalKindOf = (
  tool: string,
  at: unknown = undefined
): ApprovalKind => {
  if (tool === "create_post" && at === null) {
    return "publish";
  }

  const byName = postMoves.get(tool);

  if (byName !== undefined) {
    return byName;
  }

  if (tool === "approve_post") {
    return "approve";
  }

  if (tool === "request_changes") {
    return "requestChanges";
  }

  return approvalKinds[stepKindOf(tool)] ?? "other";
};
