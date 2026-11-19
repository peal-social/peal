import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { InboxComment } from "peal-contract";

import { commentTargetOf, writtenTo } from "#inbox/comment-target.ts";

const at = DateTime.makeUnsafe("2026-11-10T09:00:00Z");

const commentOf = (id: string, state: InboxComment["state"]): InboxComment => ({
  author: { displayName: null, handle: "ada.example", platformId: id },
  id,
  liked: false,
  parentId: null,
  permalink: null,
  privateReply: null,
  privateReplyUntil: null,
  receivedAt: at,
  state,
  text: "Synthetic comment.",
  threadId: "thread",
  writtenAt: at,
});

// Oldest first, as the server lists them.
const answered = commentOf("c1", "answered");
const waiting = commentOf("c2", "new");
const later = commentOf("c3", "new");
const latest = commentOf("c4", "hidden");

describe("whom the comment composer answers", () => {
  it("answers the oldest comment still waiting until the member chooses one", () => {
    expect([
      commentTargetOf([answered, waiting, later, latest], null),
      commentTargetOf([answered, waiting, later], {
        id: later.id,
        written: false,
      }),
    ]).toStrictEqual([waiting, later]);
  });

  it("answers the latest still shown when none waits, and nothing without comments", () => {
    const gone = commentOf("c5", "deleted");

    expect([
      commentTargetOf([answered, latest, gone], null),
      commentTargetOf([gone], null),
      commentTargetOf([], null),
    ]).toStrictEqual([latest, undefined, undefined]);
  });

  it("leaves a chosen comment the platform deleted before the member wrote", () => {
    const gone = { ...later, state: "deleted" as const };

    expect(
      commentTargetOf([answered, waiting, gone], {
        id: later.id,
        written: false,
      })
    ).toBe(waiting);
  });

  it("keeps a draft on its comment once the member writes, whatever a refresh answers", () => {
    const choice = writtenTo(waiting.id);

    // Answered elsewhere: the next read no longer has it waiting.
    const reread = [
      answered,
      { ...waiting, state: "answered" as const },
      later,
    ];

    // Deleted on the platform: the draft never moves to another author.
    const deleted = [
      answered,
      { ...waiting, state: "deleted" as const },
      later,
    ];

    expect([
      commentTargetOf(reread, choice)?.id,
      commentTargetOf(deleted, choice)?.id,
    ]).toStrictEqual([waiting.id, waiting.id]);
  });
});
