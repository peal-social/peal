import { describe, expect, it } from "@effect/vitest";

import { choiceOnDraft, replyChoice } from "#inbox/composer-choice.ts";

describe("what an inbox composer's member has chosen", () => {
  it("pins the draft to the item the composer shows at the first keystroke", () => {
    expect([
      choiceOnDraft(null, "c2", "T"),
      choiceOnDraft(replyChoice("c3"), "c3", "Thanks"),
    ]).toStrictEqual([
      { id: "c2", replied: false, written: true },
      { id: "c3", replied: true, written: true },
    ]);
  });

  it("pins to the item shown when the one Reply chose is gone", () => {
    expect(choiceOnDraft(replyChoice("c3"), "c2", "T")).toStrictEqual({
      id: "c2",
      replied: false,
      written: true,
    });
  });

  it("lets an emptied draft go back to the queue, or to the item Reply chose", () => {
    const pinned = choiceOnDraft(null, "c2", "T");
    const fromReply = choiceOnDraft(replyChoice("c3"), "c3", "T");

    expect([
      choiceOnDraft(pinned, "c2", ""),
      choiceOnDraft(fromReply, "c3", ""),
    ]).toStrictEqual([null, replyChoice("c3")]);
  });
});
