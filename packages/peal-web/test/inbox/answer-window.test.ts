import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";

import { answerWindowOf } from "#inbox/answer-window.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

// A Messenger conversation whose 24 hours shut, with a person's 7 days.
const window = {
  closesAt: at("2026-11-15T08:59:00Z"),
  open: false,
  personClosesAt: at("2026-11-21T08:59:00Z"),
};

describe("what a conversation's window lets a member do", () => {
  it("keeps the box past the 24 hours for the member's own session, while the 7 days run", () => {
    expect(
      answerWindowOf(window, true, at("2026-11-17T09:00:00Z"))
    ).toStrictEqual({
      answers: true,
      personOpen: true,
      shown: window,
    });
    expect(
      answerWindowOf(window, true, at("2026-11-22T09:00:00Z"))
    ).toStrictEqual({ answers: false, personOpen: false, shown: window });
  });

  it("shows staff acting as the member nothing of the 7 days, and no box", () => {
    expect(
      answerWindowOf(window, false, at("2026-11-17T09:00:00Z"))
    ).toStrictEqual({
      answers: false,
      personOpen: false,
      shown: { ...window, personClosesAt: null },
    });
  });

  it("answers within the 24 hours whoever writes", () => {
    const open = { ...window, open: true };

    expect(
      answerWindowOf(open, false, at("2026-11-15T08:00:00Z")).answers
    ).toBeTruthy();
  });
});
