import type { AgentStep } from "peal-contract/agent";

/** The text the agent wrote before a step, and the step. */
export interface StepSegment {
  readonly before: string;
  readonly step: AgentStep;
}

/** An answer cut where its steps fall: what came before each, then the rest. */
export interface AnswerSegments {
  /** The text after the last step: the answer itself. */
  readonly answer: string;
  readonly steps: readonly StepSegment[];
}

/**
 * An answer's text cut at its steps (`at`, the text's length when each
 * tool was called), in the order they fall; a step past the text's end
 * falls at its end. Without steps, the whole text is the answer.
 */
export const segmentsOf = (
  text: string,
  steps: readonly AgentStep[]
): AnswerSegments => {
  const ordered = steps
    .map((step, index) => ({ index, step }))
    .toSorted((a, b) => a.step.at - b.step.at || a.index - b.index);

  let from = 0;
  const segments: StepSegment[] = [];

  for (const { step } of ordered) {
    const to = Math.min(Math.max(step.at, from), text.length);

    segments.push({ before: text.slice(from, to), step });
    from = to;
  }

  return { answer: text.slice(from), steps: segments };
};
