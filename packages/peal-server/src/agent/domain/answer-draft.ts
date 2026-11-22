import type { AgentEvent } from "./agent-event.ts";
import type { AgentApproval, AgentCard, AgentStep } from "./agent-parts.ts";
import { maxAnswerLength } from "./run-limits.ts";

/** An answer as a run writes it, event by event. */
export interface AnswerDraft {
  readonly approvals: readonly AgentApproval[];
  readonly cards: readonly AgentCard[];
  readonly steps: readonly AgentStep[];
  readonly text: string;
}

export const emptyAnswer: AnswerDraft = {
  approvals: [],
  cards: [],
  steps: [],
  text: "",
};

// One item by its call: replaced where it was, added after the others
// otherwise.
const upserted = <A extends { readonly callId: string }>(
  items: readonly A[],
  item: A
): readonly A[] =>
  items.some(({ callId }) => callId === item.callId)
    ? items.map((each) => (each.callId === item.callId ? item : each))
    : [...items, item];

/**
 * The answer with one more of a run's events: text added (up to
 * `maxAnswerLength`), a step or an approval put in place by its call, a
 * card added. Other events change nothing of it.
 */
export const applied = (draft: AnswerDraft, event: AgentEvent): AnswerDraft => {
  if (event._tag === "text") {
    return {
      ...draft,
      text: `${draft.text}${event.delta}`.slice(0, maxAnswerLength),
    };
  }

  if (event._tag === "step") {
    return { ...draft, steps: upserted(draft.steps, event.step) };
  }

  if (event._tag === "card") {
    return { ...draft, cards: [...draft.cards, event.card] };
  }

  if (event._tag === "approval") {
    return { ...draft, approvals: upserted(draft.approvals, event.approval) };
  }

  return draft;
};
