// The MCP endpoint keeps the connection of a tool's call exactly when the
// API keeps the connection of the write the tool makes: each tool that
// changes something is mapped here to the API's operation it performs, and
// a tool is a content tool when that operation is a journalled write. A
// new changing tool joins this map, or the test fails.
import { describe, expect, it } from "@effect/vitest";
import { HttpApi } from "effect/http-api";
import { Api } from "peal-contract";

import { toolCatalogue } from "#app/mcp/catalogue.ts";
import { contentTools } from "#app/mcp/server.ts";
import { changesContent } from "#workspace/api/security.ts";

// Each changing tool, and the API's operation (`group.endpoint`) it does.
const operationOf = new Map(
  Object.entries({
    approve_post: "approvals.approve",
    boost_post: "ads.createBoost",
    cancel_post: "posts.cancel",
    clear_channel_defaults: "channels.defaultOptions.clear",
    confirm_comment_reply: "inbox.comments.confirmReply",
    confirm_target: "posts.confirm",
    create_channel_set: "channels.sets.create",
    create_connect_link: "channels.connectLinks.create",
    create_draft: "posts.drafts.create",
    create_feed: "automations.feeds.create",
    create_post: "posts.create",
    create_posts: "posts.bulk",
    create_queue: "automations.queues.create",
    create_review_link: "approvals.createLink",
    create_signature: "posts.signatures.create",
    create_tag: "posts.tags.create",
    create_webhook: "webhooks.create",
    delete_channel_set: "channels.sets.delete",
    delete_feed: "automations.feeds.delete",
    delete_location_review_reply: "inbox.reviews.withdrawReply",
    delete_media: "media.delete",
    delete_queue: "automations.queues.delete",
    delete_signature: "posts.signatures.delete",
    delete_tag: "posts.tags.delete",
    describe_media: "media.describe",
    disable_channel: "channels.disable",
    discard_draft: "posts.drafts.delete",
    duplicate_post: "posts.duplicate",
    edit_published_post: "posts.editTarget",
    enable_channel: "channels.enable",
    generate_image: "media.images.create",
    import_media: "media.importFromUrl",
    leave_out_rest: "posts.leaveOutRest",
    mark_comment_answered: "inbox.comments.setAnswered",
    mark_location_review_answered: "inbox.reviews.setAnswered",
    moderate_comment: "inbox.comments.moderate",
    pause_boost: "ads.pauseBoost",
    preview_feed: "automations.feeds.preview",
    publish_post: "posts.schedule",
    queue_post: "posts.enqueue",
    recycle_post: "automations.recycling.create",
    redeliver_webhooks: "webhooks.redeliverMany",
    remove_post_target: "posts.removeTarget",
    rename_channel: "channels.update",
    reply_to_comment: "inbox.comments.reply",
    reply_to_location_review: "inbox.reviews.reply",
    repost_target: "posts.repost",
    request_changes: "approvals.requestChanges",
    reschedule_post: "posts.reschedule",
    reshuffle_queue: "automations.queues.reshuffle",
    resume_boost: "ads.resumeBoost",
    resume_recycling_rule: "automations.recycling.resume",
    revoke_connect_link: "channels.connectLinks.revoke",
    revoke_review_link: "approvals.revokeLink",
    schedule_post: "posts.schedule",
    send_message: "inbox.messages.send",
    send_private_reply: "inbox.messages.sendPrivateReply",
    send_test_webhook: "webhooks.sendTest",
    set_channel_defaults: "channels.defaultOptions.set",
    set_post_external_id: "posts.setExternalId",
    start_comment_rule: "automations.commentRules.create",
    start_follow_up_rule: "automations.followUps.create",
    stop_boost: "ads.stopBoost",
    stop_comment_rule: "automations.commentRules.delete",
    stop_follow_up_rule: "automations.followUps.delete",
    stop_recycling_rule: "automations.recycling.delete",
    tag_post: "posts.setTags",
    unpublish_post: "posts.unpublish",
    unschedule_post: "posts.unschedule",
    update_channel_set: "channels.sets.update",
    update_comment_rule: "automations.commentRules.update",
    update_draft: "posts.update",
    update_feed: "automations.feeds.update",
    update_follow_up_rule: "automations.followUps.update",
    update_queue: "automations.queues.update",
    update_recycling_rule: "automations.recycling.update",
    update_signature: "posts.signatures.update",
    update_tag: "posts.tags.update",
    update_webhook: "webhooks.update",
    withdraw_comment_reply: "inbox.comments.withdrawReply",
  })
);

// The API's writes, and whether the journal keeps each.
const journalledWrite = new Map<string, boolean>();

HttpApi.reflect(Api, {
  onEndpoint: ({ endpoint, group }) => {
    if (endpoint.method !== "GET") {
      journalledWrite.set(
        `${group.identifier}.${endpoint.identifier}`,
        changesContent(endpoint.method, group, endpoint)
      );
    }
  },
  onGroup: () => {
    // Only endpoints matter.
  },
});

const changing = toolCatalogue()
  .filter(({ changes }) => changes)
  .map(({ name }) => name)
  .toSorted();

describe("the MCP tools whose calls the connection journal keeps", () => {
  it("maps every tool that changes something, and only those", () => {
    expect([...operationOf.keys()].toSorted()).toStrictEqual(changing);
  });

  it("maps each to a write of the API", () => {
    expect(
      [...operationOf].filter(
        ([, operation]) => !journalledWrite.has(operation)
      )
    ).toStrictEqual([]);
  });

  it("keeps a tool's call exactly when the API keeps its write's", () => {
    expect(
      changing.filter(
        (name) =>
          contentTools.has(name) !==
          (journalledWrite.get(operationOf.get(name) ?? "") ?? false)
      )
    ).toStrictEqual([]);
  });

  it("keeps no call of a tool that changes nothing", () => {
    expect(
      [...contentTools].filter((name) => !changing.includes(name))
    ).toStrictEqual([]);
  });
});
