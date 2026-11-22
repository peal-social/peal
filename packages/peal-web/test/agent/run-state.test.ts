import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import type { AgentApproval, AgentEvent } from "peal-contract/agent";

import {
  emptyChat,
  foldChat,
  localUserMessageId,
  pendingApprovalOf,
} from "#agent/run-state.ts";
import type { ChatAction, ChatState } from "#agent/run-state.ts";

const at = (seconds: number) =>
  DateTime.makeUnsafe(Date.UTC(2026, 10, 22, 9, 0, seconds));

const fold = (state: ChatState, actions: readonly ChatAction[]): ChatState => {
  let folded = state;

  for (const action of actions) {
    folded = foldChat(folded, action);
  }

  return folded;
};

const event = (seconds: number, happened: AgentEvent): ChatAction => ({
  _tag: "event",
  at: at(seconds),
  event: happened,
});

const approval: AgentApproval = {
  at: null,
  callId: "call-2",
  channelIds: ["channel-1"],
  inReplyTo: null,
  postId: "post-1",
  state: "pending",
  text: "Our spring sale starts today.",
  threadId: null,
  tool: "publish_post",
};

const asked = fold({ ...emptyChat, draft: "Find my drafts", loaded: true }, [
  { _tag: "sent", at: at(0), text: "Find my drafts" },
]);

describe(foldChat, () => {
  it("shows the person's message at once and empties the composer", () => {
    expect(asked.draft).toBe("");
    expect(asked.run).toStrictEqual({ messageId: null, startedAt: at(0) });
    expect(
      asked.messages.map(({ id, role, text }) => [id, role, text])
    ).toStrictEqual([[localUserMessageId, "user", "Find my drafts"]]);
  });

  it("names both messages once the run starts, then writes the answer", () => {
    const state = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(1, { _tag: "text", delta: "You have " }),
      event(2, {
        _tag: "step",
        step: {
          at: 9,
          callId: "call-1",
          state: "running",
          tool: "list_drafts",
        },
      }),
      event(3, {
        _tag: "step",
        // The server may say where it ended: it stays where it was called.
        step: { at: 20, callId: "call-1", state: "done", tool: "list_drafts" },
      }),
      event(4, { _tag: "text", delta: "two drafts." }),
      event(5, {
        _tag: "card",
        card: {
          _tag: "post",
          action: "created",
          channelIds: [],
          excerpt: "Spring",
          postId: "post-1",
          scheduledAt: null,
        },
      }),
      event(6, { _tag: "title", title: "Drafts" }),
      event(7, { _tag: "finished", durationMs: 6500, outcome: "answered" }),
    ]);

    expect(state.run).toBeNull();
    expect(state.title).toBe("Drafts");
    expect(state.messages.map(({ id }) => id)).toStrictEqual(["m1", "m2"]);
    expect(state.messages[1]).toMatchObject({
      durationMs: 6500,
      outcome: "answered",
      steps: [{ at: 9, callId: "call-1", state: "done", tool: "list_drafts" }],
      text: "You have two drafts.",
    });
    expect(state.messages[1]?.cards).toHaveLength(1);
  });

  it("waits on a change, then goes on in the same answer once approved", () => {
    const waiting = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "approval", approval }),
      event(3, {
        _tag: "finished",
        durationMs: 2000,
        outcome: "awaitingApproval",
      }),
    ]);

    expect(pendingApprovalOf(waiting)?.callId).toBe("call-2");

    const approved = fold(waiting, [
      { _tag: "answered", approved: true, at: at(10), callId: "call-2" },
    ]);

    expect([
      pendingApprovalOf(approved),
      approved.messages[1]?.approvals[0]?.state,
      approved.run,
    ]).toStrictEqual([
      undefined,
      "approved",
      { messageId: null, startedAt: at(10) },
    ]);

    const done = fold(approved, [
      event(11, { _tag: "started", messageId: "m2", userMessageId: null }),
      event(12, { _tag: "text", delta: " Published." }),
      event(13, { _tag: "finished", durationMs: 3000, outcome: "answered" }),
    ]);

    expect(done.messages).toHaveLength(2);
    expect(done.messages[1]).toMatchObject({
      outcome: "answered",
      text: " Published.",
    });
  });

  it("marks a declined change, and a new answer after it", () => {
    const declined = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "approval", approval }),
      event(3, {
        _tag: "finished",
        durationMs: 2000,
        outcome: "awaitingApproval",
      }),
      { _tag: "answered", approved: false, at: at(10), callId: "call-2" },
      event(11, { _tag: "started", messageId: "m3", userMessageId: null }),
    ]);

    expect(declined.messages.map(({ id }) => id)).toStrictEqual([
      "m1",
      "m2",
      "m3",
    ]);
    expect(declined.messages[1]?.approvals[0]?.state).toBe("declined");
  });

  it("expires a change that waits when the person writes again", () => {
    const state = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "approval", approval }),
      event(3, {
        _tag: "finished",
        durationMs: 2000,
        outcome: "awaitingApproval",
      }),
      { _tag: "sent", at: at(20), text: "Never mind" },
    ]);

    expect(state.messages[1]?.approvals[0]?.state).toBe("expired");
    expect(pendingApprovalOf(state)).toBeUndefined();
  });

  it("keeps what was written when the person stops, with how long it ran", () => {
    const state = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "text", delta: "Looking" }),
      event(2, {
        _tag: "step",
        step: {
          at: 7,
          callId: "call-1",
          state: "running",
          tool: "search_posts",
        },
      }),
      { _tag: "interrupted", at: at(4), reason: "stopped" },
    ]);

    expect(state.run).toBeNull();
    expect(state.problem).toBeNull();
    expect(state.messages[1]).toMatchObject({
      durationMs: 4000,
      outcome: "stopped",
      steps: [{ state: "failed" }],
      text: "Looking",
    });
  });

  it("says the answer was lost when the stream broke", () => {
    const state = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      { _tag: "interrupted", at: at(3), reason: "lost" },
    ]);

    expect(state.problem).toStrictEqual({ _tag: "lost" });
  });

  it("says why a run failed, keeping what came before", () => {
    const state = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "text", delta: "Half" }),
      event(3, { _tag: "failed", reason: "timedOut" }),
    ]);

    expect(state.problem).toStrictEqual({ _tag: "failed", reason: "timedOut" });
    expect(state.messages[1]).toMatchObject({
      outcome: "failed",
      text: "Half",
    });
  });

  it("puts a refused message back in the composer", () => {
    const state = fold(asked, [
      {
        _tag: "refused",
        refusal: { _tag: "Unexpected" },
        text: "Find my drafts",
      },
    ]);

    expect(state.messages).toStrictEqual([]);
    expect(state.draft).toBe("Find my drafts");
    expect(state.run).toBeNull();
    expect(state.problem).toStrictEqual({
      _tag: "refused",
      refusal: { _tag: "Unexpected" },
    });
  });

  it("reads the server's chat in, but never over a run under way", () => {
    const detail = {
      chat: {
        createdAt: at(0),
        id: "c1",
        starred: true,
        title: "Saved",
        updatedAt: at(0),
      },
      messages: [],
    };

    expect(fold(emptyChat, [{ _tag: "loaded", detail }])).toMatchObject({
      loaded: true,
      starred: true,
      title: "Saved",
    });
    expect(fold(asked, [{ _tag: "loaded", detail }]).messages).toHaveLength(1);
  });

  it("reads a chat again once it moved on, unless a run goes on", () => {
    const answered = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "finished", durationMs: 1000, outcome: "answered" }),
    ]);

    expect([
      foldChat(answered, { _tag: "stale" }).loaded,
      foldChat(asked, { _tag: "stale" }).loaded,
    ]).toStrictEqual([false, true]);
  });

  it("ignores a run's events once it ended", () => {
    const ended = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "finished", durationMs: 1000, outcome: "answered" }),
    ]);

    expect(fold(ended, [event(3, { _tag: "text", delta: "late" })])).toBe(
      ended
    );
  });

  it("rates an answer and takes the rating back", () => {
    const answered = fold(asked, [
      event(1, { _tag: "started", messageId: "m2", userMessageId: "m1" }),
      event(2, { _tag: "finished", durationMs: 1000, outcome: "answered" }),
      { _tag: "rated", messageId: "m2", rating: "up" },
    ]);

    expect(answered.messages[1]?.rating).toBe("up");
    expect(
      foldChat(answered, { _tag: "rated", messageId: "m2", rating: null })
        .messages[1]?.rating
    ).toBeNull();
  });
});
