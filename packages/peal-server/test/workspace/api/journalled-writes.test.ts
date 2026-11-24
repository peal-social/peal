// Which writes the connection journal keeps a year by law, and which the
// workspace's activity log keeps, read from the contract itself: a group
// renamed or split must not stop a write from being kept.
import { describe, expect, it } from "@effect/vitest";
import { HttpApi } from "effect/http-api";
import { Api, WorkspaceAccess } from "peal-contract";

import {
  asksForChange,
  changesContent,
  contentGroups,
} from "#workspace/api/security.ts";

interface Write {
  readonly inWorkspace: boolean;
  readonly journalled: boolean;
  readonly logged: boolean;
  readonly route: string;
}

const writes: Write[] = [];

HttpApi.reflect(Api, {
  onEndpoint: ({ endpoint, group, middleware }) => {
    if (endpoint.method === "GET") {
      return;
    }

    const operation = `${group.identifier}.${endpoint.identifier}`;

    const inWorkspace = Array.from(middleware, ({ key }) => key).includes(
      WorkspaceAccess.key
    );

    writes.push({
      inWorkspace,
      journalled: changesContent(endpoint.method, group, endpoint),
      logged: inWorkspace && asksForChange(endpoint.method, operation),
      route: `${operation} ${endpoint.method} ${endpoint.path}`,
    });
  },
  onGroup: () => {
    // Only endpoints matter.
  },
});

// Every write whose connection is kept, by operation, method and path. The
// same fifty as before the API's namespaces, each at its new place.
const journalled = [
  "approvals.approve POST /api/v1/approvals/:postId/approve",
  "approvals.comment POST /api/v1/approvals/:postId/comments",
  "approvals.createLink POST /api/v1/approvals/:postId/links",
  "approvals.requestChanges POST /api/v1/approvals/:postId/request-changes",
  "approvals.resolve PATCH /api/v1/approvals/:postId/comments/:commentId",
  "approvals.revokeLink DELETE /api/v1/approvals/links/:linkId",
  "approvals.updateSettings PUT /api/v1/approvals/settings",
  "automations.commentRules.create POST /api/v1/automations/comment-rules",
  "automations.commentRules.delete DELETE /api/v1/automations/comment-rules/:ruleId",
  "automations.commentRules.update PATCH /api/v1/automations/comment-rules/:ruleId",
  "inbox.comments.confirmReply POST /api/v1/inbox/comments/replies/:replyId/confirmation",
  "inbox.comments.moderate POST /api/v1/inbox/comments/:commentId/moderation",
  "inbox.comments.reply POST /api/v1/inbox/comments/:commentId/replies",
  "inbox.comments.setAnswered POST /api/v1/inbox/comments/:commentId/answered",
  "inbox.comments.withdrawReply DELETE /api/v1/inbox/comments/replies/:replyId",
  "inbox.messages.confirm POST /api/v1/inbox/messages/outgoing/:messageId/confirmation",
  "inbox.messages.confirmPrivateReply POST /api/v1/inbox/messages/private-replies/:privateReplyId/confirm",
  "inbox.messages.send POST /api/v1/inbox/messages/conversations/:conversationId/messages",
  "inbox.messages.sendPrivateReply POST /api/v1/inbox/messages/private-replies",
  "inbox.messages.setApplication PUT /api/v1/inbox/messages/applications",
  "inbox.messages.setChannel PUT /api/v1/inbox/messages/channels/:channelId",
  "inbox.messages.setConversationRead POST /api/v1/inbox/messages/conversations/:conversationId/read",
  "inbox.reviews.reply PUT /api/v1/inbox/reviews/:reviewId/reply",
  "inbox.reviews.setAnswered POST /api/v1/inbox/reviews/:reviewId/answered",
  "inbox.reviews.withdrawReply DELETE /api/v1/inbox/reviews/:reviewId/reply",
  "media.complete POST /api/v1/media/:mediaId/complete",
  "media.create POST /api/v1/media",
  "media.delete DELETE /api/v1/media/:mediaId",
  "media.describe PATCH /api/v1/media/:mediaId",
  "media.importFromUrl POST /api/v1/media/import",
  "posts.bulk POST /api/v1/posts/bulk",
  "posts.cancel POST /api/v1/posts/:postId/cancel",
  "posts.confirm POST /api/v1/posts/:postId/targets/:targetId/confirm",
  "posts.create POST /api/v1/posts",
  "posts.drafts.create POST /api/v1/posts/drafts",
  "posts.drafts.delete DELETE /api/v1/posts/drafts/:postId",
  "posts.duplicate POST /api/v1/posts/:postId/duplicate",
  "posts.editTarget POST /api/v1/posts/:postId/targets/:targetId/edit",
  "posts.enqueue POST /api/v1/posts/:postId/queue",
  "posts.import POST /api/v1/posts/import",
  "posts.leaveOutRest POST /api/v1/posts/:postId/targets/:targetId/leave-out-rest",
  "posts.removeTarget DELETE /api/v1/posts/:postId/targets/:targetId",
  "posts.repost POST /api/v1/posts/:postId/targets/:targetId/repost",
  "posts.reschedule POST /api/v1/posts/:postId/reschedule",
  "posts.schedule POST /api/v1/posts/:postId/schedule",
  "posts.setTags PUT /api/v1/posts/:postId/tags",
  "posts.unpublish POST /api/v1/posts/:postId/unpublish",
  "posts.unpublishTarget POST /api/v1/posts/:postId/targets/:targetId/unpublish",
  "posts.unschedule POST /api/v1/posts/:postId/unschedule",
  "posts.update PUT /api/v1/posts/:postId",
];

describe("the writes kept", () => {
  it("names the content groups whole, as the contract's identifiers", () => {
    const identifiers = new Set<string>();

    HttpApi.reflect(Api, {
      onEndpoint: () => {
        // Only groups matter.
      },
      onGroup: ({ group }) => {
        identifiers.add(group.identifier);
      },
    });

    expect([...contentGroups].toSorted()).toStrictEqual([
      "approvals",
      "automations.commentRules",
      "inbox.comments",
      "inbox.messages",
      "inbox.reviews",
      "media",
      "posts",
      "posts.drafts",
    ]);
    expect(
      [...contentGroups].filter((name) => !identifiers.has(name))
    ).toStrictEqual([]);
  });

  it("journals the connection of the fifty writes that change content", () => {
    expect(
      writes
        .flatMap(({ journalled: kept, route }) => (kept ? [route] : []))
        .toSorted()
    ).toStrictEqual(journalled);
  });

  it("logs every workspace write but the three checks, the journalled ones among them", () => {
    expect(writes.filter((write) => write.inWorkspace)).toHaveLength(158);
    expect(writes.filter((write) => write.logged)).toHaveLength(155);
    expect(
      writes.filter((write) => write.journalled && !write.logged)
    ).toStrictEqual([]);
  });

  it("neither journals nor logs a check", () => {
    for (const check of [
      "ads.quoteBoost POST",
      "channels.lookups.run POST",
      "posts.validate POST",
    ]) {
      expect(
        writes.filter(
          ({ journalled: kept, logged, route }) =>
            route.startsWith(check) && (kept || logged)
        )
      ).toStrictEqual([]);
    }
  });
});
