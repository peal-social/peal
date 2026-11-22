import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { AgentChat } from "peal-contract/agent";

import { changedKeysOf } from "#agent/changed-keys.ts";
import { ageOf, dayGroupsOf, transcriptOf } from "#agent/history.ts";
import { approvalKindOf, stepKindOf } from "#agent/steps.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

const chat = (id: string, updatedAt: string): AgentChat => ({
  createdAt: at(updatedAt),
  id,
  starred: false,
  title: null,
  updatedAt: at(updatedAt),
});

describe(ageOf, () => {
  const now = at("2026-11-22T12:00:00Z");

  it("says just now under a minute, then the largest whole unit", () => {
    expect(
      [
        "2026-11-22T11:59:30Z",
        "2026-11-22T11:45:00Z",
        "2026-11-22T10:00:00Z",
        "2026-11-19T12:00:00Z",
        "2026-11-01T12:00:00Z",
      ].map((then) => ageOf(at(then), now))
    ).toStrictEqual([
      { unit: "now" },
      { unit: "minute", value: -15 },
      { unit: "hour", value: -2 },
      { unit: "day", value: -3 },
      { unit: "week", value: -3 },
    ]);
  });
});

describe(dayGroupsOf, () => {
  it("groups chats by the reader's day, the latest first", () => {
    // 23:30 UTC is already the next day in Paris.
    const groups = dayGroupsOf(
      [
        chat("old", "2026-11-18T10:00:00Z"),
        chat("late", "2026-11-21T23:30:00Z"),
        chat("morning", "2026-11-22T08:00:00Z"),
        chat("yesterday", "2026-11-21T09:00:00Z"),
      ],
      at("2026-11-22T12:00:00Z"),
      "Europe/Paris"
    );

    expect(
      groups.map(({ chats, day }) => [
        DateTime.isDateTime(day) ? DateTime.formatIso(day) : day,
        chats.map(({ id }) => id),
      ])
    ).toStrictEqual([
      ["today", ["morning", "late"]],
      ["yesterday", ["yesterday"]],
      ["2026-11-18T10:00:00.000Z", ["old"]],
    ]);
  });
});

describe(transcriptOf, () => {
  it("writes the title, then each message under who wrote it", () => {
    expect(
      transcriptOf(
        [
          { role: "user", text: "Find my drafts" },
          { role: "assistant", text: "You have **two**." },
          { role: "assistant", text: " " },
        ],
        { agent: "Peal", person: "You", title: "Drafts" }
      )
    ).toBe(
      "# Drafts\n\n**You**\n\nFind my drafts\n\n**Peal**\n\nYou have **two**."
    );
  });
});

describe(stepKindOf, () => {
  it("names known tools, reading tools by what they read, others plainly", () => {
    expect(
      [
        "list_drafts",
        "get_post",
        "list_channels",
        "post_analytics",
        "schedule_post",
        "reply_to_comment",
        "create_draft",
        "list_comment_threads",
        "whoami",
        "read_skill",
        "something_new",
      ].map((tool) => stepKindOf(tool))
    ).toStrictEqual([
      "posts",
      "posts",
      "channels",
      "analytics",
      "scheduling",
      "replying",
      "drafting",
      "comments",
      "workspace",
      "skill",
      "other",
    ]);
  });
});

describe(approvalKindOf, () => {
  it("says what a change does from its tool", () => {
    expect(
      [
        "schedule_post",
        "publish_post",
        "unpublish_post",
        "cancel_post",
        "reply_to_comment",
        "moderate_comment",
        "send_message",
        "approve_post",
        "request_changes",
        "boost_post",
      ].map((tool) => approvalKindOf(tool))
    ).toStrictEqual([
      "schedule",
      "publish",
      "unpublish",
      "delete",
      "reply",
      "moderate",
      "message",
      "approve",
      "requestChanges",
      "other",
    ]);
  });

  it("names every change the agent's toolset asks about in its own words", () => {
    expect(
      [
        "create_post",
        "reschedule_post",
        "unschedule_post",
        "queue_post",
        "edit_published_post",
        "create_tag",
        "discard_draft",
      ].map((tool) =>
        approvalKindOf(tool, DateTime.makeUnsafe("2026-11-23T07:00:00Z"))
      )
    ).toStrictEqual([
      "schedule",
      "move",
      "unschedule",
      "queue",
      "edit",
      "tag",
      "delete",
    ]);

    // A post made with no time goes out at once.
    expect(approvalKindOf("create_post", null)).toBe("publish");
  });

  it("says what moderating or marking a comment does to it, never one title for hiding and deleting", () => {
    expect([
      approvalKindOf("moderate_comment", null, { moderation: "hide" }),
      approvalKindOf("moderate_comment", null, { moderation: "delete" }),
      approvalKindOf("moderate_comment", null, { moderation: "unlike" }),
      approvalKindOf("mark_comment_answered", null, { answered: false }),
      approvalKindOf("tag_post", null),
    ]).toStrictEqual([
      "hide",
      "deleteComment",
      "unlike",
      "markUnanswered",
      "tagPost",
    ]);
  });
});

describe(changedKeysOf, () => {
  it("refreshes the posts' pages after a post, the inbox after a thread", () => {
    const post = changedKeysOf("w1", {
      _tag: "post",
      action: "scheduled",
      channelIds: [],
      excerpt: "Hello",
      postId: "p1",
      scheduledAt: null,
    });

    expect(post).toContain("posts");
    expect(post).toContain("queues:w1");
    expect(
      changedKeysOf("w1", {
        _tag: "thread",
        action: "replied",
        excerpt: "Thanks",
        threadId: "t1",
      }).some((key) => key.includes("t1"))
    ).toBeTruthy();
  });
});
