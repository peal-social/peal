/**
 * The tools of Peal's MCP endpoint the agent may call, by name, and which
 * of them wait for the person's approval. What a marketing team needs:
 * who the person is, the channels, the posts and their drafts, the queues,
 * tags and saved items, the media, analytics, the inbox's comments and
 * reviews, and the approvals of posts. No webhooks, keys, members,
 * connections of channels, ads, feeds or automations: those are a
 * person's, in the web app. No direct messages either: the registry of
 * personal data (`peal-contract/data-processing`) promises that a
 * workspace's direct messages reach no assistant.
 */

/**
 * Tools that read, and those that write drafts, which are private to the
 * workspace and change again: they run as the model calls them.
 */
export const freeTools = [
  "whoami",
  "list_channels",
  "list_drafts",
  "get_post",
  "list_posts",
  "list_post_attempts",
  "list_post_changes",
  "create_draft",
  "update_draft",
  "duplicate_post",
  "list_tags",
  "list_signatures",
  "list_channel_sets",
  "get_channel_defaults",
  "list_queues",
  "preview_queue",
  "list_media",
  "get_media",
  "analytics_summary",
  "analytics_dashboard",
  "channel_analytics",
  "post_analytics",
  "best_times",
  "list_comment_threads",
  "get_comment_thread",
  "list_location_reviews",
  "get_location_reviews",
  "list_approvals",
  "get_post_review",
] as const;

/**
 * Tools whose change others see, cannot be undone or costs money: each
 * call waits for the person to approve it, and runs only then, with their
 * permissions as they are at that moment. Each one's card shows all it
 * does (`agent-approvals.ts`). No `create_post`: the post it makes takes
 * channel sets, signatures and default options only the server resolves,
 * so the agent writes a draft (which resolves them), and the person
 * approves scheduling or publishing the draft as the workspace holds it.
 */
export const approvedTools = [
  "schedule_post",
  "publish_post",
  "reschedule_post",
  "queue_post",
  "unschedule_post",
  "cancel_post",
  "edit_published_post",
  "unpublish_post",
  "discard_draft",
  "create_tag",
  "reply_to_comment",
  "mark_comment_answered",
  "moderate_comment",
  "reply_to_location_review",
  "approve_post",
  "request_changes",
] as const;

/**
 * Tools that run freely on a draft, and wait for the person's approval on
 * any other post: filing a post under tags changes what the team sees of
 * it once it is not a draft.
 */
export const draftFreeTools = ["tag_post"] as const;

export type AgentToolName =
  | (typeof approvedTools)[number]
  | (typeof draftFreeTools)[number]
  | (typeof freeTools)[number];

/** Every tool the agent may call. */
export const agentToolNames: readonly AgentToolName[] = [
  ...freeTools,
  ...draftFreeTools,
  ...approvedTools,
];
