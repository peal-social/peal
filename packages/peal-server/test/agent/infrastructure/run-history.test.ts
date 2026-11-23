import { describe, expect, it } from "@effect/vitest";
import { Prompt } from "effect/ai";

import { maxHistoryLength } from "#agent/domain/run-limits.ts";
import {
  withinBudget,
  withRound,
  withUserMessage,
} from "#agent/infrastructure/run-history.ts";

// A tool's answer of about this many characters, as the model reads it.
const answerOf = (length: number) => ({ rows: "x".repeat(length) });

// A turn: the person's message, then one round that calls a tool and
// reads its answer, then the model's text.
const turn = (history: Prompt.Prompt, index: number, length: number) =>
  withRound(
    withRound(
      withUserMessage(history, `Message ${String(index)}`),
      "",
      [{ callId: `call-${String(index)}`, params: {}, tool: "list_posts" }],
      [
        {
          callId: `call-${String(index)}`,
          encoded: answerOf(length),
          isFailure: false,
          tool: "list_posts",
        },
      ]
    ),
    `Answer ${String(index)}`,
    [],
    []
  );

const said = (history: Prompt.Prompt): readonly string[] =>
  history.content.flatMap((message) =>
    message.role === "user"
      ? message.content.flatMap((part) =>
          part.type === "text" ? [part.text] : []
        )
      : []
  );

// The ids of the calls the history holds, and of the answers it holds.
const pairs = (history: Prompt.Prompt) => ({
  answers: history.content.flatMap((message) =>
    message.role === "tool"
      ? message.content.flatMap((part) =>
          part.type === "tool-result" ? [part.id] : []
        )
      : []
  ),
  calls: history.content.flatMap((message) =>
    message.role === "assistant"
      ? message.content.flatMap((part) =>
          part.type === "tool-call" ? [part.id] : []
        )
      : []
  ),
});

describe("what a round sends of a chat's history", () => {
  it("sends a history within the budget whole", () => {
    const history = turn(turn(Prompt.empty, 1, 100), 2, 100);

    expect(withinBudget(history, maxHistoryLength)).toStrictEqual(history);
  });

  it("drops the oldest turns past the budget, each turn whole, from a person's message", () => {
    let history = Prompt.empty;

    for (let index = 1; index <= 6; index += 1) {
      history = turn(history, index, 4000);
    }

    const sent = withinBudget(history, 10_000);

    expect([
      said(sent),
      pairs(sent),
      sent.content[0]?.role,
      sent.content.length,
    ]).toStrictEqual([
      ["Message 5", "Message 6"],
      {
        answers: ["call-5", "call-6"],
        calls: ["call-5", "call-6"],
      },
      "user",
      8,
    ]);
  });

  it("keeps the person's last message and the latest round, a call and its answer together, past the budget", () => {
    // One turn of three rounds, larger than the budget: its first rounds
    // go, never its message nor its last call, which may wait for the
    // person.
    let history = withUserMessage(Prompt.empty, "Handle everything");

    for (const index of [1, 2, 3]) {
      history = withRound(
        history,
        "",
        [{ callId: `call-${String(index)}`, params: {}, tool: "list_posts" }],
        [
          {
            callId: `call-${String(index)}`,
            encoded: answerOf(6000),
            isFailure: false,
            tool: "list_posts",
          },
        ]
      );
    }

    const waiting = withRound(
      history,
      "I'll schedule it.",
      [{ callId: "call-ask", params: {}, tool: "schedule_post" }],
      []
    );

    const sent = withinBudget(waiting, 10_000);

    expect([said(sent), pairs(sent)]).toStrictEqual([
      ["Handle everything"],
      {
        answers: ["call-3"],
        calls: ["call-3", "call-ask"],
      },
    ]);
  });
});
