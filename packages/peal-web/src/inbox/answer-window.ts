import { DateTime } from "effect";
import type { InboxConversationDetail } from "peal-contract";

type Window = InboxConversationDetail["window"];

/** What the window lets the reader do. */
export interface AnswerWindow {
  readonly answers: boolean;
  readonly personOpen: boolean;
  readonly shown: Window;
}

/**
 * What a conversation's window lets the member reading it do, at `now`:
 * whether the box shows (`answers`), whether the 7 days a person may
 * answer by hand still run (`personOpen`), and the window to describe
 * (`shown`). The 7 days are for the member's own session (`byHand`): staff
 * acting as them are shown none of them, as the server refuses them past
 * the 24 hours.
 */
export const answerWindowOf = (
  window: Window,
  byHand: boolean,
  now: DateTime.Utc
): AnswerWindow => {
  const personOpen =
    byHand &&
    window.personClosesAt !== null &&
    DateTime.isLessThan(now, window.personClosesAt);

  return {
    answers: window.open || personOpen,
    personOpen,
    shown: byHand ? window : { ...window, personClosesAt: null },
  };
};
