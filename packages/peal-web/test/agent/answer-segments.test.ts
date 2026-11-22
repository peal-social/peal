import { describe, expect, it } from "@effect/vitest";
import type { AgentStep } from "peal-contract/agent";

import { segmentsOf } from "#agent/answer-segments.ts";

const step = (callId: string, at: number): AgentStep => ({
  at,
  callId,
  state: "done",
  tool: "list_posts",
});

describe(segmentsOf, () => {
  it("cuts the text before each step, the rest being the answer", () => {
    expect(
      segmentsOf("Let me look. Now drafts. You have two.", [
        step("c1", 13),
        step("c2", 25),
      ])
    ).toStrictEqual({
      answer: "You have two.",
      steps: [
        { before: "Let me look. ", step: step("c1", 13) },
        { before: "Now drafts. ", step: step("c2", 25) },
      ],
    });
  });

  it("keeps steps called together in their order, and the whole text without steps", () => {
    expect([
      segmentsOf("Done.", [step("c1", 0), step("c2", 0)]),
      segmentsOf("Done.", []),
    ]).toStrictEqual([
      {
        answer: "Done.",
        steps: [
          { before: "", step: step("c1", 0) },
          { before: "", step: step("c2", 0) },
        ],
      },
      { answer: "Done.", steps: [] },
    ]);
  });

  it("puts a step past the text at its end", () => {
    expect(segmentsOf("Short", [step("c1", 40)])).toStrictEqual({
      answer: "",
      steps: [{ before: "Short", step: step("c1", 40) }],
    });
  });
});
