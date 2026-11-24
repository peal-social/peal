import { describe, expect, it } from "@effect/vitest";

import { toolAreas } from "#app/mcp/catalogue.ts";
import { ToolAreaSchema } from "#app/mcp/discovery-tools.ts";
import { PealTools } from "#app/mcp/tools.ts";

// The areas find_tools sorts the tools in: the product's concerns. The
// API's namespaces are being renamed to the same names in a pull request of
// their own.

const namesIn = (area: typeof ToolAreaSchema.Type) =>
  toolAreas[area].map(({ name }) => name);

describe("the tools' areas", () => {
  it("are the product's concerns, in the order find_tools lists them", () => {
    expect(ToolAreaSchema.literals).toStrictEqual([
      "workspace",
      "posts",
      "approvals",
      "channels",
      "media",
      "inbox",
      "automations",
      "analytics",
      "links",
      "ads",
      "webhooks",
    ]);
  });

  it("hold every tool the endpoint offers, each in one area", () => {
    const listed = ToolAreaSchema.literals.flatMap(namesIn);

    expect(listed.toSorted()).toStrictEqual(
      Object.keys(PealTools.tools).toSorted()
    );
  });

  it("sort each tool by what it acts on", () => {
    expect(
      Object.fromEntries(
        ToolAreaSchema.literals.map((area) => [area, namesIn(area)])
      )
    ).toStrictEqual({
      ads: [
        "get_ads_status",
        "get_ad_account",
        "list_ad_campaigns",
        "get_ad_insights",
        "get_post_ad_performance",
        "list_boosts",
        "get_boost",
        "quote_boost",
        "boost_post",
        "pause_boost",
        "resume_boost",
        "stop_boost",
      ],
      analytics: [
        "analytics_summary",
        "analytics_dashboard",
        "channel_analytics",
        "best_times",
        "post_analytics",
      ],
      automations: [
        "list_queues",
        "preview_queue",
        "create_queue",
        "update_queue",
        "delete_queue",
        "reshuffle_queue",
        "recycle_post",
        "list_recycling_rules",
        "get_recycling_rule",
        "update_recycling_rule",
        "resume_recycling_rule",
        "stop_recycling_rule",
        "list_follow_up_rules",
        "get_follow_up_rule",
        "start_follow_up_rule",
        "update_follow_up_rule",
        "stop_follow_up_rule",
        "list_feeds",
        "get_feed",
        "preview_feed",
        "create_feed",
        "update_feed",
        "delete_feed",
        "list_comment_rules",
        "start_comment_rule",
        "update_comment_rule",
        "stop_comment_rule",
      ],
      channels: [
        "list_channels",
        "rename_channel",
        "disable_channel",
        "enable_channel",
        "get_channel_capabilities",
        "run_channel_lookup",
        "get_tiktok_creator",
        "list_channel_sets",
        "create_channel_set",
        "update_channel_set",
        "delete_channel_set",
        "get_channel_defaults",
        "set_channel_defaults",
        "clear_channel_defaults",
        "list_connect_links",
        "get_connect_link",
        "create_connect_link",
        "revoke_connect_link",
      ],
      inbox: [
        "list_comment_threads",
        "get_comment_thread",
        "reply_to_comment",
        "confirm_comment_reply",
        "withdraw_comment_reply",
        "mark_comment_answered",
        "moderate_comment",
        "list_location_reviews",
        "get_location_reviews",
        "reply_to_location_review",
        "delete_location_review_reply",
        "mark_location_review_answered",
        "list_conversations",
        "get_conversation",
        "send_message",
        "send_private_reply",
      ],
      links: ["get_short_link_status", "list_short_links", "get_short_link"],
      media: [
        "list_media",
        "get_media",
        "get_media_usage",
        "import_media",
        "generate_image",
        "describe_media",
        "delete_media",
      ],
      posts: [
        "list_drafts",
        "list_posts",
        "get_post",
        "list_post_attempts",
        "create_draft",
        "update_draft",
        "duplicate_post",
        "discard_draft",
        "schedule_post",
        "publish_post",
        "reschedule_post",
        "queue_post",
        "create_post",
        "create_posts",
        "validate_post",
        "await_post",
        "unschedule_post",
        "cancel_post",
        "remove_post_target",
        "repost_target",
        "leave_out_rest",
        "confirm_target",
        "unpublish_post",
        "edit_published_post",
        "list_post_changes",
        "list_tags",
        "create_tag",
        "update_tag",
        "delete_tag",
        "tag_post",
        "list_signatures",
        "create_signature",
        "update_signature",
        "delete_signature",
      ],
      approvals: [
        "list_approvals",
        "get_post_review",
        "approve_post",
        "request_changes",
        "list_review_links",
        "create_review_link",
        "revoke_review_link",
      ],
      webhooks: [
        "list_webhooks",
        "list_webhook_deliveries",
        "create_webhook",
        "update_webhook",
        "send_test_webhook",
        "redeliver_webhooks",
      ],
      workspace: [
        "find_tools",
        "whoami",
        "list_workspaces",
        "server_health",
        "list_members",
        "get_billing",
        "get_usage",
        "list_activity",
        "get_partner_account",
        "list_partner_workspaces",
        "get_partner_usage",
      ],
    });
  });
});
